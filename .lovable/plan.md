## Cause racine

Deux moteurs de CA en parallèle :
- **Page Revenus** : `useRevenueStreams.getYearlyRevenue()` projette les années N+1/N+2 par croissance composée appliquée au total Année 1.
- **Compte de résultat** : `computePL.getRevenueForecast()` projette mois par mois en cherchant un forecast manuel pour le même mois de l'année de base, puis applique la croissance.

Deux algorithmes → deux totaux. Aucune correction écran ne peut résoudre ça durablement.

## Principe directeur

Le revenu devient une **brique centrale du modèle financier**, pas un sous-produit du P&L. Tous les écrans (Revenus, P&L, PDF, Excel) consomment la même structure.

## Architecture cible

### 1. Nouveau module pur `engine/revenue/computeRevenue.ts`

Sortie :
```text
RevenueModel = {
  months: Date[]                              // axe temporel commun (tous mois du BP)
  byStream: Record<streamId, {
    monthly: number[]                         // un montant par mois de `months`
    yearly: number[]                          // agrégé par exercice fiscal
    metadata: {
      mode: 'variable' | 'subscription'
      revenueType: 'merchandise' | 'production' | 'service'
      monthlySources: Array<                  // traçabilité par mois
        'manual_forecast' | 'subscription' | 'growth_projection' | 'empty'
      >
      growthApplied: number[]                 // taux appliqué par année
    }
  }>
  totals: {
    monthly: number[]
    yearly: number[]
  }
}
```

Règles strictes du moteur :
- **Forecast à 0 = vraie donnée**. Interdiction de `if (forecast?.amount)`. Utiliser `forecast && forecast.amount !== null && forecast.amount !== undefined`.
- Subscription : MRR calculé depuis `bp_start_date`.
- Variable : si forecast manuel présent (même nul) → on l'utilise. Sinon, projection par croissance depuis le mois équivalent de l'année de base.
- Pas de fallback silencieux vers `monthly_price`.

### 2. Intégration dans `BPFinancialModel`

```text
BPFinancialModel = {
  revenue: RevenueModel        // NOUVEAU — calculé en premier
  pl, cashFlow, balanceSheet, fundingPlan, ratios, ...
}
```

`computeBPModel` ordonne :
1. `loanSchedules`
2. `revenue = computeRevenue(input)`     ← nouveau
3. `pl = computePL(input, revenue)`
4. `cashFlow`, `balanceSheet`, `fundingPlan`, `ratios`

### 3. `computePL` consomme `revenue`

Suppression de `getRevenueForecast` interne. Les lignes 707/701/706 sont alimentées par `revenue.byStream[id].monthly` filtré par `revenue_type`. Les coûts d'achat (`getPurchaseCostForMonth`) consomment aussi `revenue` pour rester cohérents.

### 4. Hooks frontend

- `useBPModel()` continue d'exposer le modèle complet, désormais avec `data.revenue`.
- Nouveau sélecteur : `useRevenue()` → `useBPModel().data.revenue`.
- `useRevenueStreams` reste **uniquement pour l'édition** : streams + forecasts mensuels + mutations. Tous ses helpers d'agrégation (`getYearlyRevenue`, `getTotalYearlyRevenue`, `getTotalRevenue`) sont **supprimés**.
- Consolidation des deux fichiers `useRevenueStreams` (`src/hooks/` et `src/features/business-plan/hooks/`) en une seule source.

### 5. Composants Revenus

- `RevenueTable` : conserve l'édition cellule par cellule (mutation forecasts). Les totaux mois et année viennent de `useRevenue()`.
- `RevenueSummaryCard` : lit `revenue.totals.yearly`.
- Idem pour `useVariableExpenses` (calcul du % de revenu) → branche sur `useRevenue()`.

### 6. Invalidation React Query

À chaque mutation de stream ou forecast, invalider :
- `bp_revenue_streams`
- `bp_revenue_forecasts`
- `bp_revenue_forecasts_by_streams`

`useBPModel` est un `useMemo` dérivé, il se recalcule automatiquement.

### 7. Tests anti-régression

Fixtures :
- `minimal-revenue` : 1 stream, exercice calendaire, contrôlable à la main.
- `e-fumeur-like` : exercice fiscal décalé (sept→déc Y1), forecasts mensuels réels Y1, projection Y2/Y3 par croissance.
- `with-zero-forecast` : forecast explicitement à 0 sur certains mois.
- `mid-year-stream` : stream démarrant en cours d'année.
- `subscription` : MRR avec churn et growth.

Assertions communes :
1. `model.pl.totals.revenue[i] === model.revenue.totals.yearly[i]` pour chaque année.
2. `Σ revenue.totals.monthly[mois de Y_i] === revenue.totals.yearly[i]`.
3. Forecast à 0 → reste à 0 dans `byStream.monthly`, pas de fallback.
4. Page Revenus total = `revenue.totals.yearly` (test composant avec mock du modèle).
5. Snapshot golden mis à jour intentionnellement après refactor.

### 8. Critère de validation

Sur `/bp/revenue` et `/bp/pnl`, le CA Année 1, Année 2, Année 3 doit être **strictement identique**. Sinon la PR est refusée.

## Plan d'exécution

1. Créer `engine/revenue/computeRevenue.ts` + types + tests unitaires sur les 5 fixtures.
2. Brancher `revenue` dans `computeBPModel` et `BPFinancialModel`.
3. Refactorer `computePL` pour consommer `revenue` (suppression de `getRevenueForecast`).
4. Mettre à jour la golden snapshot (changement intentionnel documenté).
5. Créer `useRevenue()` sélecteur, brancher `RevenueTable` + `RevenueSummaryCard`.
6. Nettoyer `useRevenueStreams` (suppression des helpers d'agrégation, fusion des deux fichiers).
7. Vérifier l'invalidation React Query côté mutations.
8. Tests de parité Revenus ↔ P&L.
9. Vérification fonctionnelle prod sur E-fumeur Internet : CA Année 1 identique sur les deux écrans.

## Pourquoi ce n'est pas une rustine

- Une seule fonction calcule le revenu pour tout le module BP.
- Aucun cas spécifique à un client.
- Le contrat `RevenueModel` est typé, traçable (metadata `monthlySources`), testé.
- Les deux écrans incohérents disparaissent par construction : ils lisent la même structure.
- L'export Excel et le PDF profitent de la même brique sans modification supplémentaire.