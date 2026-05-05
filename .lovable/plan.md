## PR 3 — Validateur de réconciliation financière

### Objectif
Module pur qui prend un `BPFinancialModel` et retourne la liste des écarts entre P&L, Cash Flow et Bilan. Pas de fix, pas d'UI bloquante : un **diagnostic** chiffré, exploitable par les tests, le PDF (badge "états réconciliés ✓ / écarts détectés ⚠"), et un futur panneau debug.

Cause racine traitée : aujourd'hui rien ne vérifie que les 3 états parlent entre eux. Le validateur devient le garde-fou permanent qui empêche toute régression future de PR 2+.

### Architecture

**Fichier** : `src/features/business-plan/engine/validateBPModel.ts` (pur, zéro dépendance React).

**Signature** :
```ts
export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationIssue = {
  code: string;             // ex: 'BS_CASH_MISMATCH'
  severity: ValidationSeverity;
  message: string;          // FR, lisible
  year?: number;            // 1-indexé si applicable
  expected?: number;
  actual?: number;
  delta?: number;           // actual - expected
  tolerance?: number;       // seuil utilisé
};
export type ValidationReport = {
  ok: boolean;              // true si zéro 'error'
  issues: ValidationIssue[];
  summary: { errors: number; warnings: number; infos: number };
};

export function validateBPModel(model: BPFinancialModel): ValidationReport;
```

### Règles de validation (V1 — alignées sur les écarts CTO)

Toutes les comparaisons utilisent une tolérance de **1 € absolu OU 0.1% de la base**, le max des deux (évite les faux positifs d'arrondi).

1. **`BS_CASH_MISMATCH`** (error) — pour chaque année i :
   `balanceSheet.cash[i]` doit ≈ `cashFlow.balance[lastMonthOfYearI]`.
   Aujourd'hui : faux (bilan calcule par soustraction).

2. **`BS_BALANCED`** (error) — pour chaque année i :
   `balanceSheet.totals.totalAssets[i]` ≈ `balanceSheet.totals.totalLiabilities[i]`.

3. **`PL_NET_RESULT_TO_EQUITY`** (error) — pour chaque année i ≥ 2 :
   `balanceSheet.equity[i] - balanceSheet.equity[i-1]` ≈ `pl.totals.netResult[i]` + apports nouveaux capital année i − dividendes (=0 V1).

4. **`CASH_VS_PL_PERSONNEL`** (warning) — annuel :
   `cashFlow.outflows.personnel.year + cashFlow.outflows.payrollTaxes.year` ≈ `pl.totals.personnelCosts[i] + pl.totals.payrollTaxes[i]`.
   Détecte la double-comptabilisation actuelle.

5. **`LOAN_PRINCIPAL_RECONCILIATION`** (error) — pour chaque année i :
   `bankLoans[i-1] - bankLoans[i]` (bilan) ≈ `Σ(loanPayments cash year i) - Σ(interest P&L year i)`.
   Détecte un amortissement capital incohérent.

6. **`VAT_BALANCE_TIMING`** (warning) — annuel :
   `Σ(vatPayments cash year i)` ≈ `pl.tva.balance[i]` (à un mois de décalage près, info plutôt qu'erreur si écart < 1 mois).

7. **`STREAM_REVENUE_TYPE_AMBIGUOUS`** (info, pas error) — par stream :
   stream.has_purchase_cost === true ET stream.revenue_type === 'production' → probable erreur de classification PCG (706 vs 707). Ne casse pas le bilan, juste suspect.

8. **`FUNDING_PLAN_BALANCED`** (warning) — annuel :
   `fundingPlan.totals.resources[i]` ≈ `fundingPlan.totals.uses[i]` (le funding plan est cumulatif, donc règle plutôt sur cumul total).

### Intégration

- **`computeBPModel`** : ajoute `validation: validateBPModel(modelSansValidation)` dans la sortie. Le modèle se valide lui-même → tout consommateur peut afficher un badge.
- **Tests** :
  - `validateBPModel.test.ts` (cas pédagogiques : bilan déséquilibré construit à la main → détecté).
  - `engine-parity.cloud-vapor.test.ts` reçoit un nouveau bloc qui **snapshot le rapport actuel** sur Cloud Vapor. Tant que PR 2 n'est pas faite, le snapshot contient les erreurs attendues. PR 2 fera passer ces erreurs à zéro.
- **PDF & UI** : aucun changement dans cette PR. (Branchement visuel = PR 4 ou en option à la fin si validation passe.)

### Hors périmètre PR 3
- Aucune correction financière (c'est PR 2).
- Aucun changement UI/PDF.
- Pas de validation cross-entreprise ni cross-période (ratios sectoriels, etc.).

### Livrables
- `src/features/business-plan/engine/validateBPModel.ts`
- `src/features/business-plan/engine/__tests__/validateBPModel.test.ts`
- Champ `validation: ValidationReport` ajouté à `BPFinancialModel`
- Snapshot des écarts actuels Cloud Vapor figé dans le test parité (devient la baseline avant PR 2)

### Bénéfice immédiat
Tu peux dire au CTO et au banquier : "Le moteur s'auto-diagnostique, voici la liste exhaustive des écarts détectés sur Cloud Vapor, et chacun a un code et une PR planifiée pour le résoudre." → crédibilité gagnée même avant PR 2.
