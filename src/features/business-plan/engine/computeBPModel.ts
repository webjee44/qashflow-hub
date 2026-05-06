// ============================================================
// computeBPModel — orchestrator (pure)
// ============================================================
// Build order:
//   1. Loan schedules (Lot 2.3: shared across PL, CF, BS, FP)
//   2. P&L
//   3. Cash flow      (uses schedules)
//   4. Balance sheet  (uses cash flow + schedules — Lot 2.1 + 2.3)
//   5. Funding plan   (uses schedules — Lot 2.3)
//   6. Ratios
//   7. Validation report (PR 3)
// ============================================================

import { computePL } from './computePL';
import { computeCashFlow } from './computeCashFlow';
import { computeBalanceSheet } from './computeBalanceSheet';
import { computeFundingPlan } from './computeFundingPlan';
import { computeRatios } from './computeRatios';
import { buildAllLoanSchedules } from './schedules/loanSchedule';
import { validateBPModel, ENGINE_VERSION } from './validateBPModel';
import type { BPModelInput, BPFinancialModel } from './types';

export function computeBPModel(input: BPModelInput): BPFinancialModel {
  const schedules = buildAllLoanSchedules(input.financings);
  const pl = computePL(input);
  const cashFlow = computeCashFlow(input, pl, schedules);
  const balanceSheet = computeBalanceSheet(input, pl, cashFlow, schedules);
  const fundingPlan = computeFundingPlan(input, pl, balanceSheet, schedules);
  const { ratios, getBreakEvenData } = computeRatios(pl, balanceSheet);

  const partial = { pl, cashFlow, balanceSheet, fundingPlan, ratios, getBreakEvenData };
  const validation = validateBPModel(partial, input);

  return { ...partial, validation, engineVersion: ENGINE_VERSION };
}

export type { BPModelInput, BPFinancialModel };
export * from './types';
