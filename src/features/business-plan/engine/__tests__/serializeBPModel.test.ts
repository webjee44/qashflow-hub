import { describe, it, expect } from 'vitest';
import { serializeBPModelForSnapshot } from './serializeBPModel';
import type { BPFinancialModel } from '../types';

function makeMinimalModel(): BPFinancialModel {
  return {
    pl: { years: [], rows: [], totals: {} as any, tva: { collected: [], deductible: [], balance: [] } } as any,
    cashFlow: { months: [new Date(Date.UTC(2025, 0, 1))], monthlyData: [], inflows: {} as any, outflows: {} as any, netFlow: [], balance: [], initialBalance: 0, finalBalance: 0, minBalance: 0, maxBalance: 0, monthsWithNegativeBalance: 0, lowestMonth: null, highestMonth: null, totalInflows: 0, totalOutflows: 0 } as any,
    balanceSheet: { years: [], rows: [], totals: {} as any, bfr: [], workingCapital: [], cash: [] } as any,
    fundingPlan: { years: [], rows: [], needs: {} as any, resources: {} as any, balance: [], cumulativeBalance: [] } as any,
    ratios: {} as any,
    getBreakEvenData: () => ({} as any),
    validation: { ok: true, engineVersion: '1.1.0', issues: [], summary: { errors: 0, warnings: 0, infos: 0 } },
    engineVersion: '1.1.0',
  };
}

describe('serializeBPModelForSnapshot', () => {
  it('excludes getBreakEvenData and engineVersion', () => {
    const out = serializeBPModelForSnapshot(makeMinimalModel());
    expect(out).not.toHaveProperty('getBreakEvenData');
    expect(out).not.toHaveProperty('engineVersion');
  });

  it('converts Date to YYYY-MM-DD', () => {
    const out = serializeBPModelForSnapshot(makeMinimalModel()) as any;
    expect(out.cashFlow.months[0]).toBe('2025-01-01');
  });

  it('rounds numbers to 2 decimals', () => {
    const m = makeMinimalModel();
    (m as any).cashFlow.balance = [1.234567, 9.999];
    const out = serializeBPModelForSnapshot(m) as any;
    expect(out.cashFlow.balance).toEqual([1.23, 10]);
  });

  it('sorts object keys deterministically', () => {
    const out = serializeBPModelForSnapshot(makeMinimalModel());
    const keys = Object.keys(out);
    expect(keys).toEqual([...keys].sort());
  });

  it('produces identical output for two equal models (deterministic)', () => {
    const a = JSON.stringify(serializeBPModelForSnapshot(makeMinimalModel()));
    const b = JSON.stringify(serializeBPModelForSnapshot(makeMinimalModel()));
    expect(a).toBe(b);
  });
});
