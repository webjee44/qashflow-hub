import {
  monthKey,
  firstOfMonthParis,
  buildMonthRange,
  dayKeyParis,
  isBeforeDay,
} from '@/lib/finance';
import type {
  CashFlowBucket,
  TreasuryActualLine,
  TreasuryActualMonth,
} from '../types/treasuryActuals';
import { INFLOW_BUCKETS } from '../types/treasuryActuals';

const INFLOW_SET = new Set<CashFlowBucket>(INFLOW_BUCKETS);

/**
 * Forecast entry as accepted by the engine. The engine is agnostic of the
 * actual storage table — adapters convert DB rows to this shape.
 */
export interface TreasuryForecastEntry {
  id: string;
  /** Precise date of the forecasted movement (ISO YYYY-MM-DD or Date). */
  date: string | Date;
  bucket: CashFlowBucket;
  /** Absolute positive amount. Direction is implied by `bucket`. */
  amount: number;
}

export interface TreasuryPlanMonth extends TreasuryActualMonth {
  /**
   * - 'actual'   → month entirely in the past, only actuals.
   * - 'forecast' → month entirely in the future, only forecasts.
   * - 'blended'  → current month: actuals up to asOfDate + forecasts after.
   */
  source: 'actual' | 'forecast' | 'blended';
  openingBalance: number;
  closingBalance: number;
}

export interface ComputeTreasuryPlanInput {
  actuals: TreasuryActualMonth[];
  forecasts: TreasuryForecastEntry[];
  asOfDate: Date | string;
  openingBalance: number;
  openingDate: Date | string;
  /** Optional explicit horizon; defaults to span of inputs. */
  fromDate?: string;
  toDate?: string;
}

function emptyLines(): TreasuryActualLine[] {
  return [];
}

function aggregateForecastsForMonth(
  monthForecasts: TreasuryForecastEntry[],
): TreasuryActualLine[] {
  const byBucket = new Map<CashFlowBucket, TreasuryActualLine>();
  for (const f of monthForecasts) {
    const signed = (INFLOW_SET.has(f.bucket) ? 1 : -1) * Math.abs(f.amount);
    const existing = byBucket.get(f.bucket);
    if (existing) {
      existing.amount += signed;
      existing.transactionIds.push(f.id);
    } else {
      byBucket.set(f.bucket, {
        bucket: f.bucket,
        amount: signed,
        transactionIds: [f.id],
      });
    }
  }
  return Array.from(byBucket.values());
}

function mergeLines(
  a: TreasuryActualLine[],
  b: TreasuryActualLine[],
): TreasuryActualLine[] {
  const byBucket = new Map<CashFlowBucket, TreasuryActualLine>();
  for (const src of [a, b]) {
    for (const l of src) {
      const existing = byBucket.get(l.bucket);
      if (existing) {
        existing.amount += l.amount;
        existing.transactionIds.push(...l.transactionIds);
      } else {
        byBucket.set(l.bucket, {
          bucket: l.bucket,
          amount: l.amount,
          transactionIds: [...l.transactionIds],
        });
      }
    }
  }
  return Array.from(byBucket.values());
}

function totals(lines: TreasuryActualLine[]) {
  let inflows = 0;
  let outflows = 0;
  for (const l of lines) {
    if (INFLOW_SET.has(l.bucket)) inflows += l.amount;
    else outflows += l.amount;
  }
  return { inflows, outflows, net: inflows + outflows };
}

/**
 * Builds the treasury plan month-by-month combining actuals and forecasts
 * according to asOfDate (Europe/Paris, day granularity, no prorata).
 *
 * Per month M:
 *   - end(M) < startOfDay(asOfDate)   → actuals only         (source: 'actual')
 *   - start(M) > startOfDay(asOfDate) → forecasts only       (source: 'forecast')
 *   - otherwise (current month)       → actuals + forecasts whose date > asOfDate
 *                                       (source: 'blended')
 *
 * Invariant: Σ months: openingBalance + Σ net = closingBalance.
 */
export function computeTreasuryPlan(
  input: ComputeTreasuryPlanInput,
): TreasuryPlanMonth[] {
  const { actuals, forecasts, asOfDate, openingBalance } = input;

  const asOfKey = dayKeyParis(asOfDate);
  const asOfMonthKey = asOfKey.slice(0, 7);

  // Horizon = union of inputs (and explicit overrides).
  const allMonths: string[] = [];
  const seen = new Set<string>();
  const pushMonth = (mk: string) => {
    if (!seen.has(mk)) { seen.add(mk); allMonths.push(mk); }
  };
  for (const a of actuals) pushMonth(a.monthKey);
  for (const f of forecasts) pushMonth(monthKey(f.date));
  if (input.fromDate || input.toDate) {
    const from = input.fromDate ?? allMonths[0];
    const to = input.toDate ?? allMonths[allMonths.length - 1];
    if (from && to) {
      for (const m of buildMonthRange(from, to)) pushMonth(monthKey(m));
    }
  }
  allMonths.sort();

  // Index inputs by monthKey for O(1) access.
  const actualsByMonth = new Map<string, TreasuryActualMonth>();
  for (const a of actuals) actualsByMonth.set(a.monthKey, a);
  const forecastsByMonth = new Map<string, TreasuryForecastEntry[]>();
  for (const f of forecasts) {
    const mk = monthKey(f.date);
    const arr = forecastsByMonth.get(mk) ?? [];
    arr.push(f);
    forecastsByMonth.set(mk, arr);
  }

  const out: TreasuryPlanMonth[] = [];
  let runningBalance = openingBalance;

  for (const mk of allMonths) {
    let source: TreasuryPlanMonth['source'];
    let lines: TreasuryActualLine[] = emptyLines();

    if (mk < asOfMonthKey) {
      source = 'actual';
      lines = actualsByMonth.get(mk)?.lines ?? emptyLines();
    } else if (mk > asOfMonthKey) {
      source = 'forecast';
      lines = aggregateForecastsForMonth(forecastsByMonth.get(mk) ?? []);
    } else {
      source = 'blended';
      const actualLines = actualsByMonth.get(mk)?.lines ?? emptyLines();
      const futureForecasts = (forecastsByMonth.get(mk) ?? [])
        .filter((f) => isBeforeDay(asOfDate, f.date)); // strict > asOfDate
      const forecastLines = aggregateForecastsForMonth(futureForecasts);
      lines = mergeLines(actualLines, forecastLines);
    }

    const { inflows, outflows, net } = totals(lines);
    const opening = runningBalance;
    const closing = opening + net;
    runningBalance = closing;

    out.push({
      month: firstOfMonthParis(`${mk}-01`),
      monthKey: mk,
      lines,
      totalInflows: inflows,
      totalOutflows: outflows,
      net,
      source,
      openingBalance: opening,
      closingBalance: closing,
    });
  }

  return out;
}
