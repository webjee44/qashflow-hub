// ============================================================
// useRevenue — selector on top of useBPModel
// ============================================================
// Single read-side hook for projected revenue. Components MUST use this
// instead of recomputing totals from raw forecasts.
// ============================================================

import { useBPModel } from './useBPModel';
import type { RevenueModel } from '../engine/revenue/types';
import { monthKey } from '../engine/revenue/types';

export function useRevenue(): { revenue: RevenueModel; isLoading: boolean } {
  const { data, isLoading } = useBPModel();
  return { revenue: data.revenue, isLoading };
}

export function getStreamMonthly(
  revenue: RevenueModel,
  streamId: string,
  month: Date,
): number {
  const stream = revenue.byStream[streamId];
  if (!stream) return 0;
  const idx = revenue.monthIndex[monthKey(month)];
  if (idx === undefined) return 0;
  return stream.monthly[idx] || 0;
}

export function getStreamYearly(
  revenue: RevenueModel,
  streamId: string,
  yearIndex: number,
): number {
  const stream = revenue.byStream[streamId];
  if (!stream) return 0;
  return stream.yearly[yearIndex] || 0;
}

export function getYearlyTotal(revenue: RevenueModel, yearIndex: number): number {
  return revenue.totals.yearly[yearIndex] || 0;
}

export function getMonthlyTotal(revenue: RevenueModel, month: Date): number {
  const idx = revenue.monthIndex[monthKey(month)];
  if (idx === undefined) return 0;
  return revenue.totals.monthly[idx] || 0;
}
