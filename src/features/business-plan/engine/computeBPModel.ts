// ============================================================
// computeBPModel — orchestrator (pure)
// ============================================================
// Single source of truth for all BP financial outputs.
// Hooks become selectors on top of this; PDF consumes its result.
// PR 1: parity with existing hooks. Corrections live in PR 2.
// ============================================================

import { computePL } from './computePL';
import { computeCashFlow } from './computeCashFlow';
import { computeBalanceSheet } from './computeBalanceSheet';
import { computeFundingPlan } from './computeFundingPlan';
import { computeRatios } from './computeRatios';
import type { BPModelInput, BPFinancialModel } from './types';

export function computeBPModel(input: BPModelInput): BPFinancialModel {
  const pl = computePL(input);
  const cashFlow = computeCashFlow(input, pl);
  const balanceSheet = computeBalanceSheet(input, pl);
  const fundingPlan = computeFundingPlan(input, pl, balanceSheet);
  const { ratios, getBreakEvenData } = computeRatios(pl, balanceSheet);
  return { pl, cashFlow, balanceSheet, fundingPlan, ratios, getBreakEvenData };
}

export type { BPModelInput, BPFinancialModel };
export * from './types';
