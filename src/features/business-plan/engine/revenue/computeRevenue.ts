// ============================================================
// computeRevenue — pure revenue projection engine
// ============================================================
// Single source of truth for projected revenue across the entire BP.
// Consumed by computePL, the Revenue page, and all exports.
//
// Strict rules (validated by tests):
//   1. A manual forecast row is ALWAYS used when present, even if amount === 0.
//      → Interdiction de `if (forecast?.amount)`.
//   2. NO silent fallback to `monthly_price`. If no manual forecast exists for
//      a Year 1 month, the projected value is 0.
//   3. Year N (N >= 1) months that have no manual forecast are derived from the
//      same calendar month in Year 0 (bp_start year), multiplied by compound
//      year-specific growth rates. If the Year 0 base month also has no
//      forecast, the projection is 0 (no monthly_price fallback).
//   4. Subscription streams: MRR is computed from bp_start_date. A manual
//      forecast (even 0) overrides MRR for that month.
// ============================================================

import { startOfMonth } from 'date-fns';
import { normalizeRate } from '@/lib/rateUtils';
import { buildFiscalYears } from '../buildFiscalYears';
import type { BPModelInput } from '../types';
import type {
  RevenueModel,
  RevenueStreamModel,
  RevenueSource,
  RevenueFiscalYear,
} from './types';
import { monthKey } from './types';

const VALID_REVENUE_TYPES = new Set(['merchandise', 'production', 'service']);

function resolveRevenueType(stream: any): 'merchandise' | 'production' | 'service' {
  const t = stream?.revenue_type;
  if (typeof t === 'string' && VALID_REVENUE_TYPES.has(t)) return t as any;
  return 'service';
}

function resolveMode(stream: any): 'variable' | 'subscription' {
  return stream?.model === 'subscription' ? 'subscription' : 'variable';
}

// Year-specific compound growth (decimal). Index 0 is Y1, but Y1 has no growth
// applied (it IS the base). Index 1 → growth from Y1 to Y2, etc.
function getYearGrowthRate(stream: any, yearIndex: number): number {
  if (yearIndex <= 0) return 0;
  const fallback = stream?.growth_rate ?? stream?.annual_growth_rate ?? 0;
  const raw =
    yearIndex === 1
      ? stream?.growth_rate_year2 ?? fallback
      : yearIndex === 2
      ? stream?.growth_rate_year3 ?? fallback
      : stream?.growth_rate_year4 ?? fallback;
  return normalizeRate(raw, 0);
}

function buildMonthIndex(months: Date[]): Record<string, number> {
  const idx: Record<string, number> = {};
  months.forEach((m, i) => {
    idx[monthKey(m)] = i;
  });
  return idx;
}

// Index forecasts by stream and month for O(1) lookup. The presence check is
// strict — `null`/`undefined`/missing rows mean "no manual forecast"; an
// `amount` of 0 IS a real value.
function indexForecasts(forecasts: any[]): Map<string, Map<string, number>> {
  const byStream = new Map<string, Map<string, number>>();
  for (const f of forecasts) {
    if (!f || !f.stream_id || !f.month) continue;
    const amount = f.amount;
    if (amount === null || amount === undefined) continue;
    const num = Number(amount);
    if (!Number.isFinite(num)) continue;
    const monthDate = startOfMonth(new Date(f.month));
    const key = monthKey(monthDate);
    let bucket = byStream.get(f.stream_id);
    if (!bucket) {
      bucket = new Map<string, number>();
      byStream.set(f.stream_id, bucket);
    }
    bucket.set(key, num);
  }
  return byStream;
}

function computeSubscriptionForMonth(
  stream: any,
  bpStart: Date,
  month: Date,
): number {
  const startMonth = startOfMonth(bpStart);
  const target = startOfMonth(month);
  if (target.getTime() < startMonth.getTime()) return 0;
  const monthsDiff = Math.round(
    (target.getTime() - startMonth.getTime()) / (1000 * 60 * 60 * 24 * 30),
  );
  const growth = normalizeRate(stream?.growth_rate, 0.1);
  const churn = normalizeRate(stream?.churn_rate, 0.05);
  const net = growth - churn;
  const initial = Number(stream?.initial_subscribers) || 0;
  const price = Number(stream?.monthly_price) || 0;
  if (initial === 0 || price === 0) return 0;
  const subs = Math.round(initial * Math.pow(1 + net, monthsDiff));
  return subs * price;
}

function computeStream(
  stream: any,
  months: Date[],
  fiscalYears: RevenueFiscalYear[],
  bpStart: Date,
  forecastsByStream: Map<string, Map<string, number>>,
): RevenueStreamModel {
  const mode = resolveMode(stream);
  const revenueType = resolveRevenueType(stream);
  const streamForecasts = forecastsByStream.get(stream.id) ?? new Map<string, number>();
  const bpStartYear = bpStart.getFullYear();

  const monthly = new Array<number>(months.length).fill(0);
  const monthlySources: RevenueSource[] = new Array(months.length).fill('empty');

  // Pre-compute year offset for each month (calendar based, matches legacy
  // semantics so growth is applied consistently with prior P&L behavior).
  const yearOffsetByIndex = months.map((m) => m.getFullYear() - bpStartYear);

  const growthRatesApplied = fiscalYears.map((_, i) => getYearGrowthRate(stream, i));

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const key = monthKey(m);
    const yearOffset = yearOffsetByIndex[i];

    // 1. Manual forecast wins for ALL modes (including 0).
    if (streamForecasts.has(key)) {
      monthly[i] = streamForecasts.get(key) ?? 0;
      monthlySources[i] = 'manual_forecast';
      continue;
    }

    // 2. Subscription MRR (no manual override).
    if (mode === 'subscription') {
      const value = computeSubscriptionForMonth(stream, bpStart, m);
      monthly[i] = value;
      monthlySources[i] = value !== 0 ? 'subscription' : 'empty';
      continue;
    }

    // 3. Variable mode, no forecast for this month.
    if (yearOffset <= 0) {
      // Year 0 (the base year) without a forecast → strict 0.
      // No fallback to monthly_price.
      monthly[i] = 0;
      monthlySources[i] = 'empty';
      continue;
    }

    // 4. One-shot streams: revenue exists only on Year 1, never reconducted.
    if (stream?.is_one_shot) {
      monthly[i] = 0;
      monthlySources[i] = 'empty';
      continue;
    }

    // 5. Year N >= 1 → derive from base month in Year 0 × compound growth.
    const baseKey = `${bpStartYear}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    const baseAmount = streamForecasts.get(baseKey);
    if (baseAmount === undefined || baseAmount === 0) {
      monthly[i] = 0;
      monthlySources[i] = 'empty';
      continue;
    }
    let projected = baseAmount;
    for (let y = 1; y <= yearOffset; y++) {
      projected *= 1 + getYearGrowthRate(stream, y);
    }
    monthly[i] = Math.round(projected * 100) / 100;
    monthlySources[i] = 'growth_projection';
  }

  // Aggregate per fiscal year.
  const yearly = fiscalYears.map((fy) => {
    let sum = 0;
    for (const fyMonth of fy.months) {
      const idx = months.findIndex(
        (m) => m.getFullYear() === fyMonth.getFullYear() && m.getMonth() === fyMonth.getMonth(),
      );
      if (idx >= 0) sum += monthly[idx];
    }
    return sum;
  });

  return {
    monthly,
    yearly,
    metadata: { mode, revenueType, monthlySources, growthRatesApplied },
  };
}

export function computeRevenue(input: BPModelInput): RevenueModel {
  const settings = input.settings;
  const bpStart = settings.bp_start_date
    ? startOfMonth(new Date(settings.bp_start_date))
    : startOfMonth(new Date());

  const fyRaw = buildFiscalYears({
    bpStartDate: bpStart,
    bpYears: settings.bp_years || 3,
    fiscalYearStartMonth: settings.fiscal_year_start_month || 1,
    fiscalYearStartDay: settings.fiscal_year_start_day || 1,
    firstFiscalYearEndDate: settings.first_fiscal_year_end_date
      ? new Date(settings.first_fiscal_year_end_date)
      : null,
  });
  const fiscalYears: RevenueFiscalYear[] = fyRaw.map((fy) => ({
    start: fy.start,
    end: fy.end,
    label: fy.label,
    months: fy.months,
  }));

  // Flat month axis = concatenation of all fiscal year months (already
  // contiguous by buildFiscalYears construction).
  const months: Date[] = fiscalYears.flatMap((fy) => fy.months);
  const monthIndex = buildMonthIndex(months);

  const forecastsByStream = indexForecasts(input.forecasts || []);

  const byStream: Record<string, RevenueStreamModel> = {};
  for (const stream of input.streams || []) {
    byStream[stream.id] = computeStream(
      stream,
      months,
      fiscalYears,
      bpStart,
      forecastsByStream,
    );
  }

  const totalsMonthly = new Array<number>(months.length).fill(0);
  const totalsYearly = new Array<number>(fiscalYears.length).fill(0);
  for (const id of Object.keys(byStream)) {
    const s = byStream[id];
    for (let i = 0; i < months.length; i++) totalsMonthly[i] += s.monthly[i] || 0;
    for (let i = 0; i < fiscalYears.length; i++) totalsYearly[i] += s.yearly[i] || 0;
  }

  return {
    months,
    monthIndex,
    fiscalYears,
    byStream,
    totals: { monthly: totalsMonthly, yearly: totalsYearly },
  };
}

// Convenience accessor — used by computePL when it needs the value for a
// specific (streamId, month). Returns 0 if the stream is unknown or month
// falls outside the BP horizon.
export function getMonthlyRevenue(
  model: RevenueModel,
  streamId: string,
  month: Date,
): number {
  const stream = model.byStream[streamId];
  if (!stream) return 0;
  const idx = model.monthIndex[monthKey(month)];
  if (idx === undefined) return 0;
  return stream.monthly[idx] || 0;
}
