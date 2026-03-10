

# Refactoring Prévisions : Approche "Ledger" (Forward-Only)

L'analyse de ton CTO est pertinente. Voici le plan concret pour simplifier radicalement le calcul des soldes.

## Diagnostic actuel

Le hook `useForecasts.ts` (868 lignes) fait exactement ce que le CTO décrit comme l'usine à gaz :
- **Requête massive** : charge TOUTES les transactions (`allTransactions`) en batches de 1000 pour recalculer les soldes à chaque render
- **Calcul rétroactif** : `getOpeningBalance` part du solde Bridge live, soustrait les transactions du mois courant pour trouver l'ouverture, puis marche en arrière pour les mois passés
- **Fallback fragile** : si pas de snapshot → walk backwards depuis `currentMonthOpening - netBetween` → marqué "estimé"
- **5 requêtes DB** au chargement : forecasts, actuals, uncategorized, allTransactions, balanceSnapshots + liveBankBalance

## Plan de refactoring en 3 étapes

### Étape 1 — Edge Function "backfill-snapshots"

Créer une fonction qui génère les snapshots manquants pour tous les 1ers de mois passés :

- Prend le snapshot le plus récent disponible (ou le solde Bridge actuel)
- Remonte dans le temps en soustrayant les transactions mois par mois
- Insère les résultats dans `bank_balance_snapshots` avec `snapshot_date = 'YYYY-MM-01'`
- Exécution unique, puis le CRON quotidien prend le relais

**Migration DB** : Ajouter un index sur `bank_balance_snapshots(company_id, snapshot_date)` pour des lookups rapides.

### Étape 2 — Réécrire `getOpeningBalance` et `getClosingBalance`

Remplacer la logique actuelle (130 lignes) par ~30 lignes :

```text
getOpeningBalance(month):
  SI override du mois précédent → retourner override
  SI snapshot au 1er du mois → retourner snapshot  
  SI passé/courant → fallback: snapshot le plus proche + transactions delta
  SI futur → snapshot courant + Σ forecasts nets
```

**Suppression clé** : la requête `allTransactions` (qui charge des milliers de lignes) disparaît complètement. Les snapshots remplacent le recalcul.

### Étape 3 — CRON snapshot au 1er du mois

Modifier le CRON `snapshot-balances` existant (23h UTC) pour qu'il enregistre aussi un snapshot daté du 1er du mois suivant à minuit le dernier jour. Alternativement, ajouter un second CRON le 1er de chaque mois à 00:05.

## Impact technique

| Avant | Après |
|-------|-------|
| 5+ requêtes DB dont 1 paginée | 4 requêtes légères (snapshots indexés) |
| `allTransactions` = milliers de rows | Supprimé |
| `getOpeningBalance` = 90 lignes | ~25 lignes |
| Recalcul à chaque render | Lecture directe de snapshots |
| Marqueurs "estimé (~)" fréquents | Snapshots fiables après backfill |

## Fichiers impactés

1. **Nouveau** : `supabase/functions/backfill-snapshots/index.ts` — script de rattrapage
2. **Modifié** : `src/hooks/useForecasts.ts` — suppression `allTransactions`, réécriture balance
3. **Modifié** : `supabase/functions/snapshot-balances/index.ts` — snapshot au 1er du mois
4. **Migration** : index sur `bank_balance_snapshots`
5. **Mineur** : `src/components/dashboard/BalanceChart.tsx` — aucun changement d'API nécessaire

Le `ForecastTable.tsx` (2182 lignes) n'est pas touché car il consomme déjà `getOpeningBalance`/`getClosingBalance` via le hook — l'interface reste identique.

