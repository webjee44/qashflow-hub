// ============================================================
// Revenue ↔ P&L parity (anti-regression)
// ============================================================
// Locks the contract: model.revenue.totals.yearly === model.pl.totals.revenue
// (excluding operating grants, which the P&L adds on top of stream revenue).
// If this test ever fails, two pages of the BP module are showing different
// revenue numbers — exactly the kind of incoherence we just fixed.
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { computeRevenue } from '../revenue/computeRevenue';
import { minimalBPInput } from './__fixtures__/minimal-bp';
import type { BPModelInput } from '../types';

describe('Revenue ↔ P&L parity', () => {
  it('model.revenue.totals.yearly equals P&L stream revenue every year', () => {
    const model = computeBPModel(minimalBPInput);
    const yearCount = model.pl.years.length;
    for (let i = 0; i < yearCount; i++) {
      const fromRevenue = model.revenue.totals.yearly[i] || 0;
      const fromPL =
        (model.pl.totals.merchandiseSales[i] || 0) +
        (model.pl.totals.productionSold[i] || 0);
      expect(Math.abs(fromRevenue - fromPL)).toBeLessThan(1);
    }
  });

  it('monthly totals sum to yearly totals', () => {
    const revenue = computeRevenue(minimalBPInput);
    revenue.fiscalYears.forEach((fy, yIdx) => {
      const monthlySum = fy.months.reduce((sum, m) => {
        const idx = revenue.monthIndex[
          `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
        ];
        return sum + (revenue.totals.monthly[idx] || 0);
      }, 0);
      expect(Math.abs(monthlySum - (revenue.totals.yearly[yIdx] || 0))).toBeLessThan(0.01);
    });
  });

  it('forecast amount === 0 is treated as a real value (no fallback)', () => {
    const input: BPModelInput = {
      ...minimalBPInput,
      streams: [
        {
          id: 's-zero',
          name: 'Stream à zéro',
          model: 'variable',
          revenue_type: 'service',
          monthly_price: 9999, // would be a fallback under the old engine
          growth_rate: 0,
          growth_rate_year2: 0,
          growth_rate_year3: 0,
          growth_rate_year4: 0,
        },
      ],
      forecasts: [
        { stream_id: 's-zero', month: '2025-01-01', amount: 0 },
        { stream_id: 's-zero', month: '2025-02-01', amount: 1000 },
      ],
    };
    const r = computeRevenue(input);
    const jan = r.byStream['s-zero'].monthly[0];
    const feb = r.byStream['s-zero'].monthly[1];
    expect(jan).toBe(0);
    expect(feb).toBe(1000);
    // March has no forecast row → strict 0, no monthly_price fallback.
    expect(r.byStream['s-zero'].monthly[2]).toBe(0);
  });
});
