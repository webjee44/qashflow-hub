
# Plan : Règles d'automatisation multi-critères

## Résumé
Ajouter la possibilité de créer des règles d'automatisation avec **plusieurs conditions combinées** (ET logique), notamment :
- Pattern sur la description (existant)
- Montant exact ou fourchette de montant (nouveau)

**Exemple d'usage** : "E-fumeur" + montant = 9 622,80 € → Catégorie "Fournisseurs"

---

## Architecture proposée

### Option A : Table de conditions séparée (recommandée)
Créer une table `automation_rule_conditions` pour stocker plusieurs conditions par règle :

```text
┌─────────────────────┐      ┌───────────────────────────────┐
│  automation_rules   │      │  automation_rule_conditions   │
├─────────────────────┤      ├───────────────────────────────┤
│ id                  │◄────►│ rule_id (FK)                  │
│ name                │      │ condition_field (description, │
│ target_category_id  │      │   amount, type)               │
│ is_active           │      │ condition_operator (contains, │
│ match_count         │      │   equals, greater_than, etc.) │
│ logic_operator (AND)│      │ condition_value               │
└─────────────────────┘      └───────────────────────────────┘
```

**Avantage** : Flexibilité maximale, nombre illimité de conditions.

### Option B : Colonnes additionnelles (plus simple)
Ajouter des colonnes directement à `automation_rules` :
- `amount_condition_operator` : null | equals | greater_than | less_than | between
- `amount_condition_value` : nombre ou JSON {"min": X, "max": Y}

**Avantage** : Implémentation plus rapide, pas de jointures.

**Recommandation** : Option A pour la scalabilité future.

---

## Modifications techniques

### 1. Base de données
**Migration SQL** :
```sql
CREATE TABLE automation_rule_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  condition_field text NOT NULL, -- 'description' | 'amount' | 'type'
  condition_operator text NOT NULL, -- 'contains' | 'equals' | 'greater_than' | 'less_than' | 'between'
  condition_value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS policies mirroring parent table
ALTER TABLE automation_rule_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage conditions for their rules"
ON automation_rule_conditions
FOR ALL
USING (EXISTS (
  SELECT 1 FROM automation_rules 
  WHERE automation_rules.id = automation_rule_conditions.rule_id 
    AND automation_rules.user_id = auth.uid()
));

-- Migrate existing data
INSERT INTO automation_rule_conditions (rule_id, condition_field, condition_operator, condition_value)
SELECT id, condition_field, condition_operator, condition_value 
FROM automation_rules;
```

### 2. Edge Functions

**Fichiers à modifier** :
- `supabase/functions/apply-all-automation-rules/index.ts`
- `supabase/functions/apply-automation-rule/index.ts`

**Nouvelle logique de matching** :
```typescript
function matchesRule(transaction: Transaction, conditions: RuleCondition[]): boolean {
  // Toutes les conditions doivent matcher (logique AND)
  return conditions.every(condition => {
    switch (condition.condition_field) {
      case 'description':
        return matchDescription(transaction.description, condition);
      case 'amount':
        return matchAmount(Math.abs(transaction.amount), condition);
      case 'type':
        return transaction.type === condition.condition_value;
      default:
        return false;
    }
  });
}

function matchAmount(amount: number, condition: RuleCondition): boolean {
  const value = parseFloat(condition.condition_value);
  
  switch (condition.condition_operator) {
    case 'equals':
      // Tolérance de 0.01 pour les arrondis
      return Math.abs(amount - value) < 0.01;
    case 'greater_than':
      return amount > value;
    case 'less_than':
      return amount < value;
    case 'between':
      const { min, max } = JSON.parse(condition.condition_value);
      return amount >= min && amount <= max;
    default:
      return false;
  }
}
```

### 3. Interface utilisateur

**Fichiers à modifier** :
- `src/components/automations/CreateRuleDialog.tsx`
- `src/components/automations/EditRuleDialog.tsx`
- `src/components/transactions/SuggestAutomationDialog.tsx`
- `src/hooks/useAutomationRules.ts`

**Nouveau design du formulaire** :

```text
┌──────────────────────────────────────────────────────┐
│  Créer une règle d'automatisation                    │
├──────────────────────────────────────────────────────┤
│  ┌─ Critère 1 ─────────────────────────────────────┐ │
│  │  Si la description contient...                  │ │
│  │  [EFUMEUR________________________________]       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [+ Ajouter un critère €]                           │
│                                                      │
│  ┌─ Critère 2 (optionnel) ─────────────────────────┐ │
│  │  ET le montant est égal à...                    │ │
│  │  [9622.80] €                                     │ │
│  │  [x] Supprimer ce critère                       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Alors catégoriser dans → [Fournisseurs]            │
└──────────────────────────────────────────────────────┘
```

### 4. Hook useAutomationRules

**Modifications** :
- Récupérer les conditions avec la règle (`join` ou requête séparée)
- Adapter `createRule` pour créer la règle + ses conditions
- Adapter `updateRule` pour gérer les conditions (ajout/suppression/modification)

```typescript
interface RuleCondition {
  id?: string;
  condition_field: 'description' | 'amount' | 'type';
  condition_operator: string;
  condition_value: string;
}

interface AutomationRule {
  id: string;
  name: string;
  conditions: RuleCondition[]; // Nouveau
  target_category_id: string | null;
  // ... autres champs
}
```

---

## Impact sur le CRON horaire

Le CRON (`apply-all-automation-rules`) sera mis à jour pour :
1. Récupérer les règles **avec leurs conditions** (jointure)
2. Appliquer la logique AND sur toutes les conditions
3. Maintenir les performances avec des requêtes groupées

**Performance** : L'ajout de critères supplémentaires améliore la précision et réduit les faux positifs, ce qui peut même accélérer le traitement (moins de transactions matchées par erreur).

---

## Résumé des fichiers à modifier

| Fichier | Action |
|---------|--------|
| Migration SQL | Créer table `automation_rule_conditions` |
| `apply-all-automation-rules/index.ts` | Jointure + logique multi-critères |
| `apply-automation-rule/index.ts` | Même adaptation |
| `useAutomationRules.ts` | Fetch/Create/Update avec conditions |
| `CreateRuleDialog.tsx` | UI multi-critères |
| `EditRuleDialog.tsx` | UI multi-critères |
| `SuggestAutomationDialog.tsx` | Option d'ajouter un critère montant |
| `AutomationRules.tsx` | Affichage des conditions |

---

## Étapes d'implémentation

1. **Migration DB** : Créer la table `automation_rule_conditions` et migrer les données existantes
2. **Edge Functions** : Adapter la logique de matching pour supporter plusieurs conditions
3. **Hook** : Mettre à jour `useAutomationRules` pour gérer les conditions
4. **UI Création** : Refactoriser `CreateRuleDialog` avec bouton "+ Ajouter un critère €"
5. **UI Édition** : Adapter `EditRuleDialog` de manière similaire
6. **UI Suggestion** : Proposer d'ajouter le montant dans `SuggestAutomationDialog`
7. **Affichage** : Montrer les conditions dans la liste des règles
8. **Tests** : Vérifier le CRON et l'application manuelle
