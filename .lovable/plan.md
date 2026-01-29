

# Plan d'action corrective : Système d'invitation membres

## Résumé du problème

Le système d'invitation fonctionne correctement au niveau base de données (l'utilisateur est bien membre de l'organisation et de la société). Le problème réside dans **l'architecture applicative** qui crée automatiquement des données dupliquées pour chaque utilisateur.

## Diagnostic détaillé

### Ce qui fonctionne correctement
- L'invitation est acceptée et enregistrée
- L'utilisateur est bien dans `organization_members` avec le rôle `member`
- L'utilisateur est bien dans `company_members` pour Cloud Vapor
- La fonction `has_company_access()` retourne `true`
- Les politiques RLS permettent l'accès aux données

### Ce qui ne fonctionne PAS

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ PROBLÈME RACINE : AUTO-CRÉATION DE DONNÉES PARASITES                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Quand un membre invité accède à Cloud Vapor :                             │
│                                                                             │
│  1. useBusinessPlans cherche les BP avec company_id = Cloud Vapor          │
│     └─► Ne voit QUE les BP qu'il a créés (pas ceux du propriétaire)        │
│         └─► businessPlans.length === 0                                     │
│                                                                             │
│  2. useCurrentBusinessPlan détecte qu'il n'y a pas de BP                   │
│     └─► Crée automatiquement un NOUVEAU BP "Mon Business Plan"             │
│         └─► 9 BP parasites créés pour Cloud Vapor !                        │
│                                                                             │
│  3. useBPSettings cherche les settings avec company_id = Cloud Vapor       │
│     └─► Crée un bp_settings avec bp_start_date = NULL                      │
│                                                                             │
│  4. useRevenueStreams dépend de bpSettings                                  │
│     └─► bpSettings.bp_start_date = NULL → requêtes désactivées             │
│         └─► Données VIDES affichées !                                       │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Preuves en base de données

| Table | Attendu | Réalité |
|-------|---------|---------|
| `business_plans` (Cloud Vapor) | 1 BP partagé | 11 BP (2 owner + 9 invité) |
| `bp_settings` (Cloud Vapor) | 1 setting partagé | 2 settings (avec NULL dates) |
| `bp_revenue_streams` | Visible pour invité | ✅ Accessible mais requête désactivée |

---

## Plan de correction en 3 phases

### Phase 1 : Nettoyage immédiat de la base de données

**Objectif** : Supprimer les données parasites créées automatiquement

1. **Supprimer les business_plans parasites** de l'invité pour Cloud Vapor
2. **Supprimer le bp_settings parasite** de l'invité  
3. **Corriger le bp_settings du propriétaire** (définir bp_start_date si NULL)

### Phase 2 : Refactoring des hooks Business Plan

**Objectif** : Les membres invités doivent VOIR les données existantes, pas en créer de nouvelles

#### 2.1 Modifier `useBusinessPlans.ts`
- La requête doit retourner les BP accessibles via `has_company_access`, pas seulement ceux créés par l'utilisateur
- Cela est déjà géré par la RLS, mais le hook ne doit pas déclencher de création si des BP existent

#### 2.2 Modifier `useCurrentBusinessPlan.ts`  
- **Supprimer la logique d'auto-création** pour les membres non-propriétaires
- Un membre invité ne doit JAMAIS créer de BP automatiquement
- Seul le propriétaire de la société peut créer un BP

#### 2.3 Modifier `useBPSettings.ts`
- Même logique : ne pas créer de settings si l'utilisateur n'est pas propriétaire de la société
- Utiliser les settings existants de la société

### Phase 3 : Améliorer la détection du rôle utilisateur

**Objectif** : Distinguer propriétaire vs membre invité pour chaque société

#### 3.1 Ajouter un helper `isCompanyOwner`
```typescript
const isCompanyOwner = currentCompany?.user_id === user?.id;
```

#### 3.2 Conditionner les créations automatiques
- Si `isCompanyOwner` → autoriser la création de BP/settings
- Sinon → afficher les données existantes uniquement

---

## Section technique

### Requête de nettoyage SQL

```sql
-- 1. Supprimer les BP parasites de l'invité pour Cloud Vapor
DELETE FROM business_plans 
WHERE company_id = '12ea5853-35f4-46d3-a97d-3d8f466e59d8'
  AND user_id = 'bb2f2d02-8884-4e97-8e12-2595a7186092';

-- 2. Supprimer le bp_settings parasite
DELETE FROM bp_settings
WHERE company_id = '12ea5853-35f4-46d3-a97d-3d8f466e59d8'
  AND user_id = 'bb2f2d02-8884-4e97-8e12-2595a7186092';

-- 3. Corriger bp_start_date si NULL
UPDATE bp_settings
SET bp_start_date = CURRENT_DATE
WHERE bp_start_date IS NULL;
```

### Modification de `useCurrentBusinessPlan.ts`

```typescript
export function useCurrentBusinessPlan() {
  const { businessPlans, isLoading, createBusinessPlan } = useBusinessPlans();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  
  const currentPlan = businessPlans[0];
  
  // NOUVEAU: Ne créer un BP que si l'utilisateur est propriétaire
  const isCompanyOwner = currentCompany?.user_id === user?.id;

  useEffect(() => {
    // Seulement le propriétaire peut créer un BP automatiquement
    if (!isLoading && 
        businessPlans.length === 0 && 
        isCompanyOwner &&           // ← NOUVELLE CONDITION
        !createBusinessPlan.isPending) {
      createBusinessPlan.mutate({...});
    }
  }, [isLoading, businessPlans.length, isCompanyOwner, createBusinessPlan]);

  return {
    currentPlan,
    isLoading: isLoading || (!currentPlan && isCompanyOwner && businessPlans.length === 0),
    businessPlanId: currentPlan?.id,
  };
}
```

### Modification de `useBPSettings.ts` (même pattern)

```typescript
// Ne créer des settings que si propriétaire
const isCompanyOwner = currentCompany?.user_id === user?.id;

// Dans useEffect de création automatique:
if (!settings && isCompanyOwner && !isCreating) {
  // Créer les settings par défaut
}
```

---

## Fichiers à modifier

| Fichier | Action | Priorité |
|---------|--------|----------|
| Migration SQL | Nettoyage données parasites | P0 |
| `src/hooks/useCurrentBusinessPlan.ts` | Bloquer auto-création pour non-propriétaires | P1 |
| `src/hooks/useBPSettings.ts` | Bloquer auto-création pour non-propriétaires | P1 |
| `src/hooks/useBusinessPlans.ts` | Vérifier que RLS suffit (pas de changement attendu) | P2 |

---

## Résultat attendu après correction

1. **Membre invité** sélectionne Cloud Vapor dans le menu
2. Il voit **les mêmes données** que le propriétaire (revenus, dépenses, etc.)
3. **Aucune donnée parasite** n'est créée
4. Le propriétaire reste le seul à pouvoir créer/modifier la structure du BP

