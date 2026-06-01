
# Plan — Fiabilisation projection trésorerie (enveloppes mensuelles) — v2

## Cause racine retenue

Les forecasts catégoriels sont stockés au 1er du mois (`category_forecasts.month = YYYY-MM-01`). Le moteur les traite comme des événements datés avec un filtre `forecast.date > asOfDate`. Chaque 1er du mois, tous les forecasts du mois courant sont exclus → falaise structurelle. Le `ForecastChart` aggrave en lisant les `actual` pour le mois courant (vide en début de mois).

## Règle métier cible (single source of truth)

Par bucket et par mois :

```text
mois passé clos     → actuals
mois futur          → forecast (enveloppe mensuelle entière)
mois courant        → actualsToDate + max(monthlyForecast − actualsToDate, 0)
```

Invariant `Opening + Net = Closing` préservé (addition de non-négatifs).

## Architecture — helper unique, pas de duplication

### Nouveau fichier `src/features/treasury/engine/currentMonthProjection.ts`

Helper pur, sans I/O, sans dépendance React :

```ts
export interface BucketAmounts {
  // Map bucket → signed amount (>0 inflow, <0 outflow), même convention que TreasuryActualLine
  [bucket: string]: number;
}

export interface CurrentMonthProjectionInput {
  actualByBucket: BucketAmounts;
  forecastByBucket: BucketAmounts;
}

export interface CurrentMonthProjectionOutput {
  projectedByBucket: BucketAmounts;
  // Pour debug / UI : par bucket, le surplus pris du forecast restant
  remainingByBucket: BucketAmounts;
}

// Règle unique :
//   projected[b] = sign(b) * (|actual[b]| + max(|forecast[b]| − |actual[b]|, 0))
// Travaille sur valeurs absolues puis ré-applique le signe du bucket.
export function computeCurrentMonthProjection(
  input: CurrentMonthProjectionInput,
): CurrentMonthProjectionOutput;
```

**Cette fonction est l'UNIQUE source de la règle métier.** Tout autre code qui veut une projection du mois courant doit l'appeler.

### Consommateurs

1. **`computeTreasuryPlan.ts`** — l'agrégation bucket-par-bucket du mois courant délègue à `computeCurrentMonthProjection`.
2. **`useForecasts.ts`** — nouveau helper `getMonthProjected(type, month)` qui appelle `computeCurrentMonthProjection` après avoir regroupé les catégories par bucket. `getMonthNetForecast` du mois courant lit la sortie projetée. `getClosingBalance` du mois courant expose `projectedBalance` = `opening + netProjected`.

Test unitaire dédié `currentMonthProjection.test.ts` qui couvre la règle à l'unité (mix inflow/outflow, dépassement, sous-consommation, vide).

## Contrat `source` — pas de rename partiel

Décision : **on garde `'blended'` et on ajoute un champ orthogonal `projectionMode`**.

```ts
export interface TreasuryPlanMonth extends TreasuryActualMonth {
  source: 'actual' | 'forecast' | 'blended';          // INCHANGÉ
  projectionMode?: 'current_projected';                // nouveau, présent ssi source==='blended'
  openingBalance: number;
  closingBalance: number;
  // Co-exposition pour l'UI (pas de recalcul côté composant)
  actualLines: TreasuryActualLine[];
  forecastLines: TreasuryActualLine[];
  projectedLines: TreasuryActualLine[];
}
```

Tous les consommateurs existants qui matchent sur `source === 'blended'` continuent de fonctionner. Le nouveau champ est consulté uniquement par l'UI Forecast (chart + tooltip) pour afficher la projection.

## Surface technique

### 1. `src/features/treasury/engine/currentMonthProjection.ts` (NOUVEAU)
Helper pur + tests.

### 2. `src/features/treasury/engine/computeTreasuryPlan.ts`
- Indexer les forecasts par `monthKey` (enveloppes mensuelles), retirer le filtre `date > asOfDate`.
- Mois courant : appeler `computeCurrentMonthProjection`. `source` reste `'blended'`, on ajoute `projectionMode: 'current_projected'`.
- Renvoyer `actualLines`, `forecastLines`, `projectedLines` co-exposés.

### 3. `src/hooks/useForecasts.ts`
- `getMonthProjected(type, month)` (passe par le helper unique).
- `getMonthNetForecast` mois courant → utilise projeté.
- `getClosingBalance` mois courant → champ supplémentaire `projectedBalance = opening + netProjected` (rétro-compat : `balance` et `forecastBalance` conservés).
- **Marche avant futurs** : la boucle `getOpeningBalance` qui projette mois par mois doit, pour le mois courant, additionner `netProjected` (pas `netForecast` brut, ni `netActual`). C'est ce qui garantit que juillet démarre depuis la projection juin.

### 4. `src/components/forecasts/ForecastChart.tsx`
- Mois passés : `actual`. Mois futurs : `forecast`. Mois courant : valeurs projetées + `projectedBalance`.
- Tooltip mois courant : `Réel à date / Prévu / Projection fin de mois`.

Le tableau (`ForecastTable.tsx`) reste inchangé sur la grille catégorielle (colonnes Réel/Prévu intactes). Seule la ligne « Variation nette / Solde fin de mois » du mois courant bascule sur la projection.

## Tests (obligatoires)

### `currentMonthProjection.test.ts` (helper pur)
1. Tous les buckets vides → projection vide.
2. Forecast seul, actual vide → projection = forecast.
3. Actual partiel < forecast (par bucket) → projection = forecast.
4. Actual qui dépasse forecast (par bucket) → projection = actual.
5. Mix : un bucket dépassé, un autre sous-consommé → règle appliquée indépendamment par bucket.
6. Outflows : signe négatif préservé.

### `computeTreasuryPlan.test.ts` (engine)
7. 1er du mois sans actuals → mois courant projette le forecast complet (≠ zéro).
8. Mois passés → `source: 'actual'`, mois futurs → `source: 'forecast'`.
9. Mois courant → `source: 'blended'` + `projectionMode: 'current_projected'` (contrat non cassé).
10. **Marche avant — NOUVEAU TEST OBLIGATOIRE** :
    - Setup : actuals juin (mois courant) avec revenue 400k > forecast revenue 250k, opening 100k.
    - Forecasts juillet : revenue 250k, expenses 200k.
    - Vérifier : `openingBalance(juillet) === closingBalance(juin) === 100k + netProjected(juin)`, **pas** `100k + netActual(juin)` brut.
    - Concrètement : si actual juin = +200k net (réel dépasse), juillet doit ouvrir à 300k, pas à autre chose.
11. Invariant `Opening + Σ projected.net = Closing` sur horizon mixte.

### `useForecasts.test.ts` (intégration légère)
12. Mock catégories + forecasts + actuals : `getClosingBalance(currentMonth).projectedBalance` aligne sur le moteur, et `getOpeningBalance(nextMonth).balance` part bien de cette projection.

## Zones à risque

- **Double-comptage** : si un code consommateur lit à la fois `forecastLines` et `projectedLines`, risque d'addition. → audit grep des usages de `TreasuryPlanMonth` dans la PR.
- **Tableau vs Graphique** : la ligne de total mois courant du tableau doit afficher la projection pour éviter écart visuel.
- **Memory mise à jour** : `treasury-forecast-ledger-architecture` + `forecast-arithmetic-consistency` à compléter avec la sémantique du mois courant (helper unique).

## Livraison

PR atomique :
- `currentMonthProjection.ts` + `currentMonthProjection.test.ts`
- `computeTreasuryPlan.ts` + tests étendus (cas 7–11)
- `useForecasts.ts` + test intégration (cas 12)
- `ForecastChart.tsx` (consommation + tooltip)
- `ForecastTable.tsx` (ligne totale mois courant uniquement)
- Update mémoire

Validation visuelle Cloud Vapor au 1er juin : barre juin = ~257k vert / ~268k rouge, courbe ne plonge plus brutalement, juillet démarre depuis la projection juin.
