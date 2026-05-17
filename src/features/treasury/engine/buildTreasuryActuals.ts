import {
  monthKey,
  firstOfMonthParis,
  buildMonthRange,
} from '@/lib/finance';
import type {
  CashFlowBucket,
  TreasuryActualLine,
  TreasuryActualMonth,
  TreasuryActualTransaction,
} from '../types/treasuryActuals';
import { INFLOW_BUCKETS } from '../types/treasuryActuals';

const INFLOW_SET = new Set<CashFlowBucket>(INFLOW_BUCKETS);

export interface BuildTreasuryActualsOptions {
  /** Inclusive lower bound (YYYY-MM-DD). If omitted, derived from data. */
  fromDate?: string;
  /** Inclusive upper bound (YYYY-MM-DD). If omitted, derived from data. */
  toDate?: string;
}

/**
 * Aggregates raw treasury transactions into monthly buckets.
 *
 * Rules:
 *   - Internal transfers are skipped (already neutralized at engine level).
 *   - If `cashFlowBucket` is set on the row → used as-is.
 *   - If `cashFlowBucket` is null → fallback to
 *     `uncategorized_inflow` (type=income) or `uncategorized_outflow` (type=expense).
 *   - Amounts are signed in the output: > 0 inflow, < 0 outflow.
 *
 * Output is always dense over the month range (empty months yield empty lines).
 */
export function buildTreasuryActuals(
  transactions: TreasuryActualTransaction[],
  options: BuildTreasuryActualsOptions = {},
): TreasuryActualMonth[] {
  const usable = transactions.filter((t) => !t.isInternalTransfer);

  // Determine month range.
  let from = options.fromDate;
  let to = options.toDate;
  if (!from || !to) {
    if (usable.length === 0) return [];
    const dates = usable.map((t) => t.date).sort();
    from = from ?? dates[0];
    to = to ?? dates[dates.length - 1];
  }
  const months = buildMonthRange(from, to);

  // Group transactions by (monthKey, bucket).
  const grouped = new Map<string, Map<CashFlowBucket, TreasuryActualLine>>();
  for (const m of months) {
    grouped.set(monthKey(m), new Map());
  }

  for (const tx of usable) {
    const mk = monthKey(tx.date);
    const monthMap = grouped.get(mk);
    if (!monthMap) continue; // outside requested range

    const bucket: CashFlowBucket =
      tx.cashFlowBucket
      ?? (tx.type === 'income' ? 'uncategorized_inflow' : 'uncategorized_outflow');

    const signedAmount = (tx.type === 'income' ? 1 : -1) * tx.amount;

    const existing = monthMap.get(bucket);
    if (existing) {
      existing.amount += signedAmount;
      existing.transactionIds.push(tx.id);
    } else {
      monthMap.set(bucket, {
        bucket,
        amount: signedAmount,
        transactionIds: [tx.id],
      });
    }
  }

  // Materialize ordered months with totals.
  return months.map((month) => {
    const mk = monthKey(month);
    const lines = Array.from(grouped.get(mk)?.values() ?? []);

    let totalInflows = 0;
    let totalOutflows = 0;
    for (const l of lines) {
      if (INFLOW_SET.has(l.bucket)) totalInflows += l.amount;
      else totalOutflows += l.amount; // negative
    }

    return {
      month: firstOfMonthParis(month),
      monthKey: mk,
      lines,
      totalInflows,
      totalOutflows,
      net: totalInflows + totalOutflows,
    };
  });
}
