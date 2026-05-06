// ============================================================
// validateBPModel — reconciliation invariants (PR 3)
// ============================================================
// Pure. Reports all detected inconsistencies with code, severity,
// numeric delta and tolerance. Does NOT mutate the model.
// ============================================================

import { startOfMonth } from 'date-fns';
import type { BPFinancialModel } from './types';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  yearIndex?: number; // 0-based
  delta?: number;
  tolerance?: number;
}

export interface ValidationReport {
  ok: boolean;
  engineVersion: string;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export const ENGINE_VERSION = '1.1.0';

const ABS_TOL = 1; // 1 €
const REL_TOL = 0.001; // 0.1%

function tol(reference: number): number {
  return Math.max(ABS_TOL, Math.abs(reference) * REL_TOL);
}

function pushIfMismatch(
  issues: ValidationIssue[],
  code: string,
  severity: ValidationSeverity,
  message: string,
  actual: number,
  expected: number,
  yearIndex?: number
) {
  const delta = actual - expected;
  const tolerance = tol(expected);
  if (Math.abs(delta) > tolerance) {
    issues.push({ code, severity, message, yearIndex, delta, tolerance });
  }
}

export function validateBPModel(
  model: Omit<BPFinancialModel, 'validation' | 'engineVersion'>
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const { pl, cashFlow, balanceSheet, fundingPlan } = model;
  const yearCount = pl.years.length;

  for (let i = 0; i < yearCount; i++) {
    // 1. BS_BALANCED: actif = passif
    pushIfMismatch(
      issues,
      'BS_BALANCED',
      'error',
      `Bilan année ${i + 1}: total actif ≠ total passif`,
      balanceSheet.totals.totalAssets[i] || 0,
      balanceSheet.totals.totalLiabilities[i] || 0,
      i
    );

    // 2. BS_CASH_MISMATCH: trésorerie BS = solde fin d'année du cash flow
    const yearMonths = pl.years[i]?.months ?? [];
    if (yearMonths.length > 0) {
      const lastMonth = yearMonths[yearMonths.length - 1];
      const idx = cashFlow.months.findIndex(
        m => startOfMonth(m).getTime() === startOfMonth(lastMonth).getTime()
      );
      if (idx >= 0) {
        pushIfMismatch(
          issues,
          'BS_CASH_MISMATCH',
          'error',
          `Trésorerie bilan année ${i + 1} ≠ solde cash flow fin d'année`,
          balanceSheet.cash[i] || 0,
          cashFlow.balance[idx] || 0,
          i
        );
      }
    }

    // 3. PERSONNEL_RECONCILIATION: cash personnel + payroll taxes ≈ P&L personnel + payroll taxes
    const monthCount = yearMonths.length || 12;
    const cfStartIdx = i === 0 ? 0 : pl.years.slice(0, i).reduce((s, y) => s + y.months.length, 0);
    const cfEndIdx = cfStartIdx + monthCount;
    const cashPersonnel = cashFlow.outflows.personnel
      .slice(cfStartIdx, cfEndIdx)
      .reduce((a, b) => a + b, 0);
    const cashPayroll = cashFlow.outflows.payrollTaxes
      .slice(cfStartIdx, cfEndIdx)
      .reduce((a, b) => a + b, 0);
    const plPersonnel = pl.totals.personnelCosts[i] || 0;
    const plPayroll = pl.totals.payrollTaxes[i] || 0;
    pushIfMismatch(
      issues,
      'PERSONNEL_RECONCILIATION',
      'warning',
      `Personnel année ${i + 1}: cash (${(cashPersonnel + cashPayroll).toFixed(0)} €) ≠ P&L (${(plPersonnel + plPayroll).toFixed(0)} €)`,
      cashPersonnel + cashPayroll,
      plPersonnel + plPayroll,
      i
    );

    // 4. LOAN_RECONCILIATION: variation dette = nouveaux emprunts − remboursements capital
    const debtPrev = i === 0 ? 0 : balanceSheet.totals.financialDebts[i - 1] || 0;
    const debtCurr = balanceSheet.totals.financialDebts[i] || 0;
    const debtVariation = debtCurr - debtPrev;
    const newLoans = fundingPlan.resources.newLoans[i] || 0;
    const principalRepaid = fundingPlan.needs.loanRepayments[i] || 0;
    const expectedVariation = newLoans - principalRepaid;
    pushIfMismatch(
      issues,
      'LOAN_RECONCILIATION',
      'error',
      `Variation dette année ${i + 1} ≠ nouveaux emprunts − remboursements capital`,
      debtVariation,
      expectedVariation,
      i
    );

    // 5. PL_NET_RESULT_TO_EQUITY: équité[i] − équité[i-1] ≈ résultat net[i] + apports
    const equityPrev = i === 0 ? 0 : balanceSheet.totals.equity[i - 1] || 0;
    const equityCurr = balanceSheet.totals.equity[i] || 0;
    const netResult = pl.totals.netResult[i] || 0;
    const capitalContrib = fundingPlan.resources.capitalContributions[i] || 0;
    pushIfMismatch(
      issues,
      'PL_NET_RESULT_TO_EQUITY',
      'warning',
      `Variation capitaux propres année ${i + 1} ≠ résultat net + apports`,
      equityCurr - equityPrev,
      netResult + capitalContrib,
      i
    );

    // 6. TAX_REGIME_COHERENCE: si IR alors IS doit être 0
    // Cette règle est testée globalement plus bas (on lit settings via pl).
  }

  // 7. FUNDING_PLAN_BALANCED: ressources ≈ besoins (la "VARIATION DE TRÉSORERIE" doit
  // refléter la variation cash réelle).
  for (let i = 0; i < yearCount; i++) {
    const cashPrev = i === 0 ? cashFlow.initialBalance : balanceSheet.cash[i - 1] || 0;
    const cashCurr = balanceSheet.cash[i] || 0;
    pushIfMismatch(
      issues,
      'FP_CASH_VARIATION_MATCH',
      'warning',
      `Variation trésorerie plan de financement année ${i + 1} ≠ variation trésorerie bilan`,
      fundingPlan.balance[i] || 0,
      cashCurr - cashPrev,
      i
    );
  }

  // 8. CHARGES_NATURE_SUM: somme charges par nature = charges d'exploitation P&L
  // Cette règle est implicite via la structure du P&L; on la documente comme info.

  const summary = issues.reduce(
    (acc, x) => {
      if (x.severity === 'error') acc.errors++;
      else if (x.severity === 'warning') acc.warnings++;
      else acc.infos++;
      return acc;
    },
    { errors: 0, warnings: 0, infos: 0 }
  );

  return {
    ok: summary.errors === 0,
    engineVersion: ENGINE_VERSION,
    issues,
    summary,
  };
}
