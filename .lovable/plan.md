## Objectif PR 1 (finalisation)

Tout le BP (écran + PDF) doit lire **un seul** `BPFinancialModel` calculé par `computeBPModel`. Pas de changement comportemental — parité stricte avec aujourd'hui (les corrections financières sont PR 2). Cause racine traitée : suppression des recalculs dupliqués hook-par-hook qui font diverger UI et PDF.

## État actuel

Déjà fait au tour précédent :
- Engine pur en place : `engine/computeBPModel.ts` + `computePL`, `computeCashFlow`, `computeBalanceSheet`, `computeFundingPlan`, `computeRatios`, `types.ts`
- `useBPModel` agrège les inputs et appelle l'engine
- `useProfitLoss` est déjà un sélecteur sur `useBPModel`

Reste à faire :
- 4 hooks à convertir en sélecteurs
- 1 hook canonique dupliqué côté `src/hooks/` à aligner
- PDF (BPDocument + BPExportDialog) à brancher sur le modèle unifié
- Tests parité

## Changements

### 1. Sélecteurs (parité stricte)
Réécrire en sélecteurs minces :
- `src/features/business-plan/hooks/useBPCashFlow.ts` → retourne `model.cashFlow` + helpers `isHealthy`, `getMinimumInitialCash` (pure, dérivés du modèle)
- `src/features/business-plan/hooks/useFundingPlan.ts` → retourne `model.fundingPlan` + helpers `isBalanced`, `getFundingGap`, `getCAF`
- `src/features/business-plan/hooks/useBPRatios.ts` → retourne `model.ratios` + `model.getBreakEvenData` + `getRatioStatus` (helper pur conservé localement)
- `src/hooks/useBalanceSheet.ts` (canonique) → réécrit comme sélecteur sur `useBPModel`. `src/features/business-plan/hooks/useBalanceSheet.ts` reste un re-export.

Chaque hook réécrit garde **exactement la même signature publique** (interfaces `CashFlowData`, `FundingPlanData`, `FinancialRatios`, `BreakEvenData`, `BalanceSheetData` inchangées) — aucun consommateur (pages, charts, components) ne change.

### 2. Hook canonique
`src/hooks/useFundingPlan.ts`, `src/hooks/useBPCashFlow.ts`, `src/hooks/useBPRatios.ts` : transformés en simples re-exports vers les sélecteurs `features/business-plan/hooks/*` pour éliminer la duplication. Source unique de vérité côté `features/business-plan/`.

### 3. Engine — sortie BalanceSheet/Ratios
Vérifier que `computeBalanceSheet` produit déjà tous les champs requis (`bfr`, `workingCapital`, `cash`, `totals.*`, `rows`) — c'est le cas. Idem `computeRatios` (déjà OK).

### 4. PDF
`src/features/business-plan/dialogs/BPExportDialog.tsx` :
- Remplace les 5 hooks (`useProfitLoss`, `useBalanceSheet`, `useBPCashFlow`, `useFundingPlan`, `useBPRatios`) par **un seul** `const { data: model } = useBPModel()`
- Passe `model` à `<BPDocument model={model} settings={settings} ... />`

`src/features/business-plan/pdf/BPDocument.tsx` :
- Nouvelle prop unique `model: BPFinancialModel` (au lieu de `plData/bsData/fpData/cashFlowData/ratios/getBreakEvenData`)
- À l'intérieur : `const { pl: plData, balanceSheet: bsData, fundingPlan: fpData, cashFlow: cashFlowData, ratios, getBreakEvenData } = model;` (alias locaux pour préserver le reste du composant intact)
- Aucun calcul dans le PDF — déjà le cas, on ne fait que sécuriser le contrat

### 5. Garde anti-régression — parité
Ajouter `src/features/business-plan/__tests__/engine-parity.cloud-vapor.test.ts` :
- Charge `__fixtures__/cloud-vapor.json`
- Appelle `computeBPModel(input)`
- Snapshot des 4 sorties critiques : `pl.totals`, `cashFlow.balance`, `balanceSheet.totals`, `fundingPlan.balance`, `ratios`
- Compare aux valeurs courantes (snapshot fait au commit) → toute régression PR 1 est immédiatement visible

Passer un des tests `todo` de `invariants.cloud-vapor.test.ts` en test actif : "PDF et écran lisent la même balance trésorerie année 1" (sécurité unification).

### 6. Notes architecturales
- Aucun composant UI ni page n'est modifié (signatures préservées)
- `useBPModel` est appelé une seule fois par arbre React grâce au cache React Query (clés stables par `companyId` / `streamIds`)
- Les sélecteurs restent thin (lecture + helpers purs) — pas de `useMemo` lourd
- Pas de hardcode, pas de patch local, source unique = `computeBPModel`

## Hors périmètre (PR 2+)
Toute correction financière (normalizeRate, COGS vs services, amortissements réels, lien P&L → tréso, IS/IR, capital social, bilan équilibré, etc.) reste pour PR 2. PR 1 = unification structurelle uniquement.

## Validation
1. `bun test` — tous tests verts (parité + invariants existants)
2. Vérification visuelle : `/bp/pl`, `/bp/cash-flow`, `/bp/balance-sheet`, `/bp/funding-plan`, `/bp/ratios` doivent afficher exactement les mêmes valeurs qu'avant
3. Export PDF Cloud Vapor : valeurs identiques au PDF actuel (les anomalies métier restent — c'est PR 2 qui les corrigera)

## Livrables
- 4 hooks réécrits en sélecteurs
- 3 hooks `src/hooks/` transformés en re-exports
- BPDocument refactoré avec prop `model` unique
- BPExportDialog branché sur `useBPModel`
- 1 test de parité snapshot + 1 invariant activé
