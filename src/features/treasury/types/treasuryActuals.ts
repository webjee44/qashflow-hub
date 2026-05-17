/**
 * Cash-flow buckets used by the Treasury engine.
 *
 * STORED in `categories.cash_flow_bucket` (nullable enum, PR3).
 * The two `uncategorized_*` variants are NEVER stored — they are derived by
 * `buildTreasuryActuals` when a transaction has no bucket on its category.
 */
export type StoredCashFlowBucket =
  | 'revenue'
  | 'other_inflow'
  | 'fixed_expenses'
  | 'variable_expenses'
  | 'personnel'
  | 'payroll_taxes'
  | 'investments'
  | 'loan_payments'
  | 'vat_payments'
  | 'tax_payments';

export type CashFlowBucket =
  | StoredCashFlowBucket
  | 'uncategorized_inflow'
  | 'uncategorized_outflow';

export const INFLOW_BUCKETS: readonly CashFlowBucket[] = [
  'revenue',
  'other_inflow',
  'uncategorized_inflow',
] as const;

export const OUTFLOW_BUCKETS: readonly CashFlowBucket[] = [
  'fixed_expenses',
  'variable_expenses',
  'personnel',
  'payroll_taxes',
  'investments',
  'loan_payments',
  'vat_payments',
  'tax_payments',
  'uncategorized_outflow',
] as const;

/**
 * Row returned by `getTreasuryActuals`. Amounts are absolute positive numbers;
 * `type` carries the direction (income | expense).
 */
export interface TreasuryActualTransaction {
  id: string;
  companyId: string;
  date: string;                 // ISO YYYY-MM-DD
  type: 'income' | 'expense';
  amount: number;               // absolute positive
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  cashFlowBucket: StoredCashFlowBucket | null;
  bridgeAccountId: number | null;
  isInternalTransfer: boolean;  // derived, never trusted from the row itself
}

export interface TreasuryActualLine {
  bucket: CashFlowBucket;
  amount: number;               // signed: > 0 inflow, < 0 outflow
  transactionIds: string[];
}

export interface TreasuryActualMonth {
  month: Date;                  // first of month, Paris anchor
  monthKey: string;             // YYYY-MM
  lines: TreasuryActualLine[];
  totalInflows: number;
  totalOutflows: number;        // signed negative
  net: number;
}
