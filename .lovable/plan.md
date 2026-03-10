

## Refactoring Prévisions : Approche "Ledger" (Forward-Only) — ✅ TERMINÉ

### Ce qui a été fait

1. **Edge Function `backfill-snapshots`** — Créée et exécutée. Génère les snapshots au 1er de chaque mois passé pour toutes les sociétés en marchant en arrière depuis le snapshot le plus récent.

2. **Refactoring `useForecasts.ts`** — Simplifié radicalement :
   - ❌ Supprimé la requête `allTransactions` (milliers de lignes chargées en batches)
   - ✅ `getOpeningBalance` réécrit en ~35 lignes (vs ~90 avant) : lecture directe des snapshots pour le passé/courant, walk forward pour le futur
   - ✅ `getClosingBalance` inchangé (consomme déjà `getOpeningBalance`)
   - ✅ `isLoading` ne dépend plus de `transactionsLoading`

3. **Infrastructure** :
   - ✅ Index ajouté sur `bank_balance_snapshots(company_id, snapshot_date)`
   - ✅ `snapshot-balances` mis à jour pour enregistrer un snapshot au 1er du mois (le 1er de chaque mois)
   - ✅ `config.toml` mis à jour avec `backfill-snapshots`

### Architecture résultante

```
Passé/Courant → Snapshot au 1er du mois (DB lookup direct)
Futur → Snapshot courant + Σ forecasts nets (walk forward)
```

Aucune reconstruction rétroactive. Aucun chargement massif de transactions.
