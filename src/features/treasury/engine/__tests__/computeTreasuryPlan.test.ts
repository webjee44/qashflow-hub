import { describe, it, expect } from 'vitest';
import { computeTreasuryPlan, type TreasuryForecastEntry } from '../computeTreasuryPlan';
import type { TreasuryActualMonth } from '../../types/treasuryActuals';
import { firstOfMonthParis } from '@/lib/finance';

function actualMonth(
  mk: string,
  lines: TreasuryActualMonth['lines'],
): TreasuryActualMonth {
  let inflows = 0, outflows = 0;
  for (const l of lines) {
    if (['revenue', 'other_inflow', 'uncategorized_inflow'].includes(l.bucket)) inflows += l.amount;
    else outflows += l.amount;
  }
  return {
    month: firstOfMonthParis(`${mk}-01`),
    monthKey: mk,
    lines,
    totalInflows: inflows,
    totalOutflows: outflows,
    net: inflows + outflows,
  };
}

describe('computeTreasuryPlan', () => {
  it('past month = actuals only, future month = forecasts only', () => {
    const actuals: TreasuryActualMonth[] = [
      actualMonth('2026-03', [
        { bucket: 'revenue', amount: 1000, transactionIds: ['a1'] },
        { bucket: 'personnel', amount: -300, transactionIds: ['a2'] },
      ]),
    ];
    const forecasts: TreasuryForecastEntry[] = [
      { id: 'f1', date: '2026-05-10', bucket: 'revenue', amount: 500 },
    ];
    const out = computeTreasuryPlan({
      actuals, forecasts,
      asOfDate: '2026-04-15',
      openingBalance: 0,
      openingDate: '2026-03-01',
    });

    expect(out.map((m) => `${m.monthKey}/${m.source}`)).toEqual([
      '2026-03/actual',
      '2026-05/forecast',
    ]);
    expect(out[0].net).toBe(700);
    expect(out[1].net).toBe(500);
  });

  it('current month uses monthly forecast envelope rule (no more day-strict filter)', () => {
    const actuals: TreasuryActualMonth[] = [
      actualMonth('2026-04', [
        { bucket: 'revenue', amount: 200, transactionIds: ['a1'] },
      ]),
    ];
    // All three forecasts are MONTHLY envelopes for April; date is only
    // used to extract the month part. Their daily positions are irrelevant.
    const forecasts: TreasuryForecastEntry[] = [
      { id: 'rev', date: '2026-04-01', bucket: 'revenue', amount: 500 },        // envelope 500
      { id: 'pers', date: '2026-04-01', bucket: 'personnel', amount: 50 },      // envelope 50
    ];
    const out = computeTreasuryPlan({
      actuals, forecasts,
      asOfDate: '2026-04-15',
      openingBalance: 0,
      openingDate: '2026-04-01',
    });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('blended');
    expect(out[0].projectionMode).toBe('current_projected');
    // Revenue: actual 200 < envelope 500 → projected 500
    expect(out[0].totalInflows).toBe(500);
    // Personnel: no actual, envelope 50 → projected -50
    expect(out[0].totalOutflows).toBe(-50);
    expect(out[0].net).toBe(450);
    // Co-exposed views
    expect(out[0].actualLines.find((l) => l.bucket === 'revenue')?.amount).toBe(200);
    expect(out[0].forecastLines.find((l) => l.bucket === 'revenue')?.amount).toBe(500);
    expect(out[0].projectedLines.find((l) => l.bucket === 'revenue')?.amount).toBe(500);
  });

  it('1st of the month with no actuals → current month projects full forecast (no cliff)', () => {
    const forecasts: TreasuryForecastEntry[] = [
      { id: 'rev', date: '2026-06-01', bucket: 'revenue', amount: 257_000 },
      { id: 'fix', date: '2026-06-01', bucket: 'fixed_expenses', amount: 268_000 },
    ];
    const out = computeTreasuryPlan({
      actuals: [],
      forecasts,
      asOfDate: '2026-06-01',
      openingBalance: 100_000,
      openingDate: '2026-06-01',
    });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('blended');
    expect(out[0].projectionMode).toBe('current_projected');
    expect(out[0].totalInflows).toBe(257_000);
    expect(out[0].totalOutflows).toBe(-268_000);
    expect(out[0].closingBalance).toBe(100_000 - 11_000);
  });

  it('current month with actuals > forecast → projection follows actuals', () => {
    const actuals = [
      actualMonth('2026-06', [
        { bucket: 'revenue', amount: 400_000, transactionIds: ['a'] },
      ]),
    ];
    const forecasts: TreasuryForecastEntry[] = [
      { id: 'rev', date: '2026-06-01', bucket: 'revenue', amount: 250_000 },
    ];
    const out = computeTreasuryPlan({
      actuals, forecasts,
      asOfDate: '2026-06-20',
      openingBalance: 0,
      openingDate: '2026-06-01',
    });
    expect(out[0].totalInflows).toBe(400_000);
    expect(out[0].net).toBe(400_000);
  });

  it('FORWARD WALK — next month opens from current projected closing (not from raw actual)', () => {
    // June (current): opening 100k, actual revenue 200k (no expense booked yet),
    // forecast revenue 250k, forecast personnel 50k.
    //   Actual revenue 200 < envelope 250 → projected revenue = 250
    //   Actual personnel 0  < envelope 50  → projected personnel = -50
    //   projected net = +200, projected closing = 300k.
    // July: revenue 250k, expenses 200k → opening MUST be 300k, not 300k from raw actual either.
    // The point: if we walked from raw actuals (only +200k revenue → closing 300k),
    // we'd get the same number by coincidence. So we make actuals EXCEED forecast on
    // one bucket to disambiguate:
    //   Actual revenue 400k (>250 envelope) → projected = 400k
    //   Actual personnel 0 < 50 envelope → projected = -50
    //   projected net = +350 → projected closing = 450k
    //   raw actual net would be +400 (closing 500k) → DIFFERENT, so the test is meaningful.
    const actuals = [
      actualMonth('2026-06', [
        { bucket: 'revenue', amount: 400_000, transactionIds: ['a1'] },
      ]),
    ];
    const forecasts: TreasuryForecastEntry[] = [
      { id: 'jun-rev', date: '2026-06-01', bucket: 'revenue', amount: 250_000 },
      { id: 'jun-pers', date: '2026-06-01', bucket: 'personnel', amount: 50_000 },
      { id: 'jul-rev', date: '2026-07-01', bucket: 'revenue', amount: 250_000 },
      { id: 'jul-fix', date: '2026-07-01', bucket: 'fixed_expenses', amount: 200_000 },
    ];
    const out = computeTreasuryPlan({
      actuals, forecasts,
      asOfDate: '2026-06-20',
      openingBalance: 100_000,
      openingDate: '2026-06-01',
    });

    const june = out.find((m) => m.monthKey === '2026-06')!;
    const july = out.find((m) => m.monthKey === '2026-07')!;

    expect(june.source).toBe('blended');
    expect(june.net).toBe(350_000); // 400 actual revenue + (-50) projected personnel
    expect(june.closingBalance).toBe(450_000);

    expect(july.source).toBe('forecast');
    // CRITICAL: July opens from June PROJECTED closing, not from raw actual closing.
    expect(july.openingBalance).toBe(450_000);
    expect(july.net).toBe(50_000);
    expect(july.closingBalance).toBe(500_000);
  });

  it('maintains Opening + Net = Closing invariant across past / current / future', () => {
    const actuals: TreasuryActualMonth[] = [
      actualMonth('2026-01', [{ bucket: 'revenue', amount: 100, transactionIds: ['a'] }]),
      actualMonth('2026-02', [{ bucket: 'personnel', amount: -40, transactionIds: ['b'] }]),
      actualMonth('2026-03', [{ bucket: 'revenue', amount: 60, transactionIds: ['c'] }]),
    ];
    const forecasts: TreasuryForecastEntry[] = [
      { id: 'f-mar-rev', date: '2026-03-01', bucket: 'revenue', amount: 100 },
      { id: 'f-apr-rev', date: '2026-04-15', bucket: 'revenue', amount: 80 },
      { id: 'f-may-fix', date: '2026-05-10', bucket: 'fixed_expenses', amount: 25 },
    ];
    const out = computeTreasuryPlan({
      actuals, forecasts,
      asOfDate: '2026-03-15',
      openingBalance: 500,
      openingDate: '2026-01-01',
    });

    let running = 500;
    for (const m of out) {
      expect(m.openingBalance).toBe(running);
      expect(m.closingBalance).toBe(running + m.net);
      running = m.closingBalance;
    }
  });
});
