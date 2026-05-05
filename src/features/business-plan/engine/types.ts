// ============================================================
// BP Engine — types
// ============================================================
// Single source of truth for the Business Plan financial model.
// All hooks and the PDF consume `BPFinancialModel`.
// ============================================================

import type { PLData } from '../hooks/useProfitLoss';
import type { BalanceSheetData } from '@/hooks/useBalanceSheet';
import type { CashFlowData } from '../hooks/useBPCashFlow';
import type { FundingPlanData } from '../hooks/useFundingPlan';
import type { FinancialRatios, BreakEvenData } from '../hooks/useBPRatios';

export interface BPSettingsInput {
  initial_cash: number;
  customer_payment_delay: number;
  supplier_payment_delay: number;
  tax_regime: string;
  is_pme: boolean;
  fiscal_year_start_month: number;
  fiscal_year_start_day: number;
  bp_start_date: string | null;
  bp_years: number;
  show_stocks: boolean;
  show_financing: boolean;
  show_funding_plan: boolean;
}

export interface BPModelInput {
  settings: BPSettingsInput;
  streams: any[];
  forecasts: any[];
  fixedExpenses: any[];
  variableExpenses: any[];
  personnel: any[];
  directors: any[];
  investments: any[];
  financings: any[];
  stocks: any[];
}

export interface BPFinancialModel {
  pl: PLData;
  cashFlow: CashFlowData;
  balanceSheet: BalanceSheetData;
  fundingPlan: FundingPlanData;
  ratios: FinancialRatios;
  getBreakEvenData: (yearIndex: number) => BreakEvenData;
}
