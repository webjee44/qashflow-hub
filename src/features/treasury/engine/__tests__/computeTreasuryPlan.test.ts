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

  it('current month blends actuals + forecasts strictly after asOfDate', () => {
    const actuals: TreasuryActualMonth[] = [
      actualMonth('2026-04', [
        { bucket: 'revenue', amount: 200, transactionIds: ['a1'] },
      ]),
    ];
    const forecasts: TreasuryForecastEntry[] = [
      { id: 'before', date: '2026-04-10', bucket: 'revenue', amount: 999 }, // ignored
      { id: 'same',   date: '2026-04-15', bucket: 'revenue', amount: 999 }, // ignored (not strict >)
      { id: 'after',  date: '2026-04-20', bucket: 'revenue', amount: 100 }, // kept
      { id: 'late',   date: '2026-04-25', bucket: 'personnel', amount: 50 }, // kept (outflow)
    ];
    const out = computeTreasuryPlan({
      actuals, forecasts,
      asOfDate: '2026-04-15',
      openingBalance: 0,
      openingDate: '2026-04-01',
    });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('blended');
    // Revenue: 200 (actual) + 100 (forecast after) = 300
    // Personnel: -50 (forecast after)
    expect(out[0].totalInflows).toBe(300);
    expect(out[0].totalOutflows).toBe(-50);
    expect(out[0].net).toBe(250);
  });

  it('maintains Opening + Net = Closing invariant across months', () => {
    const actuals: TreasuryActualMonth[] = [
      actualMonth('2026-01', [{ bucket: 'revenue', amount: 100, transactionIds: ['a'] }]),
      actualMonth('2026-02', [{ bucket: 'personnel', amount: -40, transactionIds: ['b'] }]),
    ];
    const forecasts: TreasuryForecastEntry[] = [
      { id: 'f1', date: '2026-03-15', bucket: 'revenue', amount: 80 },
      { id: 'f2', date: '2026-04-10', bucket: 'fixed_expenses', amount: 25 },
    ];
    const out = computeTreasuryPlan({
      actuals, forecasts,
      asOfDate: '2026-02-28',
      openingBalance: 500,
      openingDate: '2026-01-01',
    });

    let running = 500;
    for (const m of out) {
      expect(m.openingBalance).toBe(running);
      expect(m.closingBalance).toBe(running + m.net);
      running = m.closingBalance;
    }
    expect(out[out.length - 1].closingBalance).toBe(500 + 100 - 40 + 80 - 25);
  });
});
