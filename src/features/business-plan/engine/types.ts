// ============================================================
// BP Engine — types (single source of truth)
// ============================================================
// Canonical shapes consumed by all hooks and the PDF.
// Mirrors today's interfaces verbatim — no behavioral change.
// ============================================================

import type { PLData } from '../hooks/useProfitLoss.types';

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
  first_fiscal_year_end_date: string | null;
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

// ─── Balance Sheet ───
export interface BalanceSheetRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total';
  values: number[];
  indent?: number;
  alertNegative?: boolean;
}

export interface BalanceSheetData {
  years: { label: string; endDate: Date }[];
  rows: BalanceSheetRow[];
  totals: {
    fixedAssets: number[];
    currentAssets: number[];
    totalAssets: number[];
    equity: number[];
    financialDebts: number[];
    operatingDebts: number[];
    totalLiabilities: number[];
  };
  bfr: number[];
  workingCapital: number[];
  cash: number[];
}

// ─── Cash Flow ───
export interface CashFlowDetailedInflows {
  revenue: number[];
  loanDisbursements: number[];
  capitalContributions: number[];
  grants: number[];
  currentAccountContributions: number[];
  total: number[];
}

export interface CashFlowDetailedOutflows {
  fixedExpenses: number[];
  variableExpenses: number[];
  personnel: number[];
  directors: number[];
  payrollTaxes: number[];
  investments: number[];
  loanPayments: number[];
  leasePayments: number[];
  vatPayments: number[];
  taxPayments: number[];
  total: number[];
}

export interface CashFlowMonthData {
  month: Date;
  monthLabel: string;
  inflows: {
    revenue: number;
    loanDisbursements: number;
    capitalContributions: number;
    grants: number;
    currentAccountContributions: number;
    total: number;
  };
  outflows: {
    fixedExpenses: number;
    variableExpenses: number;
    personnel: number;
    directors: number;
    payrollTaxes: number;
    investments: number;
    loanPayments: number;
    leasePayments: number;
    vatPayments: number;
    taxPayments: number;
    total: number;
  };
  netFlow: number;
  balance: number;
}

export interface CashFlowData {
  months: Date[];
  monthlyData: CashFlowMonthData[];
  inflows: CashFlowDetailedInflows;
  outflows: CashFlowDetailedOutflows;
  netFlow: number[];
  balance: number[];
  initialBalance: number;
  finalBalance: number;
  minBalance: number;
  maxBalance: number;
  monthsWithNegativeBalance: number;
  lowestMonth: { month: Date; balance: number; index: number } | null;
  highestMonth: { month: Date; balance: number; index: number } | null;
  totalInflows: number;
  totalOutflows: number;
}

// ─── Funding Plan ───
export interface FundingPlanRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total';
  values: number[];
  isNeed?: boolean;
  indent?: number;
}

export interface FundingPlanData {
  years: string[];
  rows: FundingPlanRow[];
  needs: {
    investments: number[];
    bfrVariation: number[];
    loanRepayments: number[];
    dividends: number[];
    totalNeeds: number[];
  };
  resources: {
    caf: number[];
    capitalContributions: number[];
    newLoans: number[];
    currentAccounts: number[];
    totalResources: number[];
  };
  balance: number[];
  cumulativeBalance: number[];
}

// ─── Ratios ───
export interface FinancialRatios {
  grossMargin: number[];
  operatingMargin: number[];
  netMargin: number[];
  roe: number[];
  roa: number[];
  currentRatio: number[];
  quickRatio: number[];
  cashRatio: number[];
  debtToEquity: number[];
  debtToAssets: number[];
  interestCoverage: number[];
  dso: number[];
  dpo: number[];
  cashConversionCycle: number[];
  breakEvenRevenue: number[];
  breakEvenMonths: number[];
  safetyMargin: number[];
}

export interface BreakEvenData {
  revenue: number;
  fixedCosts: number;
  variableCosts: number;
  breakEvenPoint: number;
  breakEvenMonths: number;
  safetyMarginPercent: number;
}

// ─── Aggregate ───
import type { ValidationReport } from './validateBPModel';

export interface BPFinancialModel {
  pl: PLData;
  cashFlow: CashFlowData;
  balanceSheet: BalanceSheetData;
  fundingPlan: FundingPlanData;
  ratios: FinancialRatios;
  getBreakEvenData: (yearIndex: number) => BreakEvenData;
  validation: ValidationReport;
  engineVersion: string;
}
