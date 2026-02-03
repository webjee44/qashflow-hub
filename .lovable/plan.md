

# Plan : Fonctionnalité "Diviser en plusieurs" (simplifié)

## Workflow utilisateur

1. **Clic sur "Diviser"** dans le menu ⋯ d'une transaction
2. **Modal s'ouvre** avec :
   - Champ : "Nombre de transactions" avec input numérique
   - Bouton "Appliquer" → génère N lignes avec répartition égale
   - Tableau des sous-transactions : Catégorie (Select) | Montant TTC (éditable) | Supprimer
   - Ligne "Total" vs "Montant à répartir" pour validation
3. **Validation** : total doit égaler le montant original (±0,01€)
4. **Bouton "Diviser"** : crée les N transactions et masque l'originale

---

## Interface simplifiée

```text
┌───────────────────────────────────────────────────────────────────────┐
│  ✂ Diviser en plusieurs                                          ✕  │
│  Prlv Sepa Humanis Prevoy Cotisations Ple Trg                        │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│     Nombre de transactions : [  2  ]  [Appliquer]                    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │         Catégorie                              Montant TTC     │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  [Sélectionnez une catégorie ▾]               [1 271,39 €] [✕] │  │
│  │  [Sélectionnez une catégorie ▾]               [1 271,39 €] [✕] │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                      Total     2 542,78 €      │  │
│  │                        Montant à répartir      2 542,78 €  ✓   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│                                          [Annuler]  [Diviser]        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Comportement

### Répartition automatique (clic sur "Appliquer")
- Montant / N arrondi à 2 décimales
- Dernière ligne ajustée pour absorber l'écart (ex: 2542,78 / 3 → 847,59 + 847,59 + 847,60)

### Édition manuelle
- L'utilisateur peut modifier chaque montant individuellement
- Le total se recalcule en temps réel
- Suppression d'une ligne avec le bouton ✕ (minimum 2 lignes)

### Validation
- ✓ vert si total = montant original (±0,01€)
- ✗ rouge si différence, bouton "Diviser" désactivé

---

## Modifications techniques

### 1. Migration base de données
```sql
ALTER TABLE transactions 
ADD COLUMN parent_transaction_id UUID REFERENCES transactions(id);
```

### 2. Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/components/transactions/SplitTransactionDialog.tsx` | **Créer** |
| `src/components/transactions/TransactionTableRow.tsx` | Ajouter action "Diviser" |
| `src/components/transactions/TransactionsView.tsx` | Intégrer le dialog |
| `src/hooks/useTransactions.ts` | Ajouter mutation `splitTransaction` |

### 3. Logique de division
```typescript
// Répartition équitable
const baseAmount = Math.floor((total / count) * 100) / 100;
const remainder = total - (baseAmount * count);

const splits = Array.from({ length: count }, (_, i) => ({
  categoryId: null,
  amount: i === count - 1 ? baseAmount + remainder : baseAmount,
}));
```

---

## Résultat après division

- Transaction originale → soft-deleted (`deleted_at` renseigné)
- N nouvelles transactions créées avec :
  - Même date, même type (income/expense)
  - Description : "HUMANIS PREVOY (1/2)", "HUMANIS PREVOY (2/2)"
  - `parent_transaction_id` pointant vers l'originale
  - `source: 'split'`

