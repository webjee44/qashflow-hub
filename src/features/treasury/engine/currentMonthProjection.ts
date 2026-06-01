// ============================================================
// currentMonthProjection — single source of truth
// ============================================================
// Pure helper that computes the "projected end-of-month" view
// for the CURRENT month, bucket by bucket. Used by:
//   - computeTreasuryPlan (treasury engine)
//   - useForecasts (React hook driving the UI)
//
// Business rule (validated by CTO):
//   For each bucket b on the current month:
//     projected[b] = sign(b) * ( |actual[b]| + max(|forecast[b]| - |actual[b]|, 0) )
//
//   In plain English: keep what's already happened, top up with whatever
//   forecast envelope is still un-consumed. If the actual already exceeds
//   the forecast envelope, the actual wins (projection follows reality).
//
// This file MUST remain free of I/O, React, and any cash-flow domain
// specifics beyond the sign of buckets — it is the lowest level primitive.
// ============================================================

import type { CashFlowBucket, TreasuryActualLine } from '../types/treasuryActuals';
import { INFLOW_BUCKETS } from '../types/treasuryActuals';

const INFLOW_SET = new Set<CashFlowBucket>(INFLOW_BUCKETS);

/** Signed amount per bucket (>0 inflow, <0 outflow). */
export type BucketAmounts = Partial<Record<CashFlowBucket, number>>;

export interface CurrentMonthProjectionInput {
  actualByBucket: BucketAmounts;
  forecastByBucket: BucketAmounts;
}

export interface CurrentMonthProjectionOutput {
  projectedByBucket: BucketAmounts;
  /** Per bucket, the unconsumed forecast envelope that was added on top of actual. */
  remainingByBucket: BucketAmounts;
}

function sign(bucket: CashFlowBucket): 1 | -1 {
  return INFLOW_SET.has(bucket) ? 1 : -1;
}

/**
 * Apply the single projection rule independently for every bucket present
 * in either side. Inputs and outputs share the same signed convention.
 */
export function computeCurrentMonthProjection(
  input: CurrentMonthProjectionInput,
): CurrentMonthProjectionOutput {
  const { actualByBucket, forecastByBucket } = input;

  const allBuckets = new Set<CashFlowBucket>([
    ...(Object.keys(actualByBucket) as CashFlowBucket[]),
    ...(Object.keys(forecastByBucket) as CashFlowBucket[]),
  ]);

  const projected: BucketAmounts = {};
  const remaining: BucketAmounts = {};

  for (const b of allBuckets) {
    const actualAbs = Math.abs(actualByBucket[b] ?? 0);
    const forecastAbs = Math.abs(forecastByBucket[b] ?? 0);
    const unconsumed = Math.max(forecastAbs - actualAbs, 0);
    const projectedAbs = actualAbs + unconsumed;

    if (projectedAbs !== 0) projected[b] = sign(b) * projectedAbs;
    if (unconsumed !== 0) remaining[b] = sign(b) * unconsumed;
  }

  return { projectedByBucket: projected, remainingByBucket: remaining };
}

// ============================================================
// Adapters
// ============================================================

/** Convert an array of signed TreasuryActualLine into a BucketAmounts map. */
export function linesToBucketAmounts(lines: TreasuryActualLine[]): BucketAmounts {
  const out: BucketAmounts = {};
  for (const l of lines) {
    out[l.bucket] = (out[l.bucket] ?? 0) + l.amount;
  }
  return out;
}

/**
 * Convert a BucketAmounts map back into TreasuryActualLine[]. transactionIds
 * are intentionally empty: the projection is a derived view, not a
 * transaction set.
 */
export function bucketAmountsToLines(amounts: BucketAmounts): TreasuryActualLine[] {
  const out: TreasuryActualLine[] = [];
  for (const [bucket, amount] of Object.entries(amounts)) {
    if (!amount) continue;
    out.push({
      bucket: bucket as CashFlowBucket,
      amount,
      transactionIds: [],
    });
  }
  return out;
}
