import {
  monthKey,
  firstOfMonthParis,
  buildMonthRange,
  dayKeyParis,
} from '@/lib/finance';
import type {
  CashFlowBucket,
  TreasuryActualLine,
  TreasuryActualMonth,
} from '../types/treasuryActuals';
import { INFLOW_BUCKETS } from '../types/treasuryActuals';
import {
  computeCurrentMonthProjection,
  linesToBucketAmounts,
  bucketAmountsToLines,
} from './currentMonthProjection';

const INFLOW_SET = new Set<CashFlowBucket>(INFLOW_BUCKETS);

/**
 * Forecast entry as accepted by the engine. The engine is agnostic of the
 * actual storage table — adapters convert DB rows to this shape.
 *
 * Note: forecasts are treated as MONTHLY ENVELOPES. The `date` field is
 * normalized to its month (YYYY-MM) for matching and for the current-month
 * projection rule. We do NOT compare day-by-day against asOfDate anymore —
 * doing so causes month-start cliffs (forecasts stored at the 1st are
 * filtered out on the 1st), which is the bug this engine was tracking.
 */
export interface TreasuryForecastEntry {
  id: string;
  /** ISO YYYY-MM-DD or Date. Only the month part is used. */
  date: string | Date;
  bucket: CashFlowBucket;
  /** Absolute positive amount. Direction is implied by `bucket`. */
  amount: number;
}

export interface TreasuryPlanMonth extends TreasuryActualMonth {
  /**
   * - 'actual'   → month entirely in the past, only actuals.
   * - 'forecast' → month entirely in the future, only forecasts.
   * - 'blended'  → current month: combination of actuals and forecast envelope.
   *
   * Stable contract: any consumer matching on `source === 'blended'` keeps
   * working. The PROJECTION rule applied to blended months is exposed via
   * `projectionMode` and via the co-exposed `*Lines` arrays.
   */
  source: 'actual' | 'forecast' | 'blended';
  /**
   * Set ONLY when `source === 'blended'`. Identifies which projection
   * algorithm was used to derive `lines` / `net` / `closingBalance` for the
   * current month. Today the only value is 'current_projected' (the rule
   * defined in `currentMonthProjection.ts`).
   */
  projectionMode?: 'current_projected';
  openingBalance: number;
  closingBalance: number;
  /**
   * Co-exposed views for the UI. Components MUST NOT recompute these.
   *   - actualLines     : what's already booked this month (always defined)
   *   - forecastLines   : full monthly forecast envelope (always defined)
   *   - projectedLines  : === lines for past/future; for blended months,
   *                       result of computeCurrentMonthProjection.
   */
  actualLines: TreasuryActualLine[];
  forecastLines: TreasuryActualLine[];
  projectedLines: TreasuryActualLine[];
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
 * Builds the treasury plan month-by-month combining actuals and monthly
 * forecast envelopes according to asOfDate (Europe/Paris, month granularity
 * for the projection rule).
 *
 * Per month M:
 *   - M < currentMonth → actuals only                 (source: 'actual')
 *   - M > currentMonth → forecasts only               (source: 'forecast')
 *   - M = currentMonth → bucket-by-bucket projection  (source: 'blended',
 *                                                      projectionMode: 'current_projected')
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
    const actualLines: TreasuryActualLine[] =
      actualsByMonth.get(mk)?.lines ?? [];
    const forecastLines: TreasuryActualLine[] = aggregateForecastsForMonth(
      forecastsByMonth.get(mk) ?? [],
    );

    let source: TreasuryPlanMonth['source'];
    let projectionMode: TreasuryPlanMonth['projectionMode'] | undefined;
    let projectedLines: TreasuryActualLine[];

    if (mk < asOfMonthKey) {
      source = 'actual';
      projectedLines = actualLines;
    } else if (mk > asOfMonthKey) {
      source = 'forecast';
      projectedLines = forecastLines;
    } else {
      source = 'blended';
      projectionMode = 'current_projected';
      // Single source of truth — see currentMonthProjection.ts
      const { projectedByBucket } = computeCurrentMonthProjection({
        actualByBucket: linesToBucketAmounts(actualLines),
        forecastByBucket: linesToBucketAmounts(forecastLines),
      });
      projectedLines = bucketAmountsToLines(projectedByBucket);
    }

    const { inflows, outflows, net } = totals(projectedLines);
    const opening = runningBalance;
    const closing = opening + net;
    runningBalance = closing;

    out.push({
      month: firstOfMonthParis(`${mk}-01`),
      monthKey: mk,
      lines: projectedLines,
      totalInflows: inflows,
      totalOutflows: outflows,
      net,
      source,
      projectionMode,
      openingBalance: opening,
      closingBalance: closing,
      actualLines,
      forecastLines,
      projectedLines,
    });
  }

  return out;
}
