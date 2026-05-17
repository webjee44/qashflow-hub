import { describe, it, expect } from 'vitest';
import { buildTreasuryActuals } from '../buildTreasuryActuals';
import type { TreasuryActualTransaction } from '../../types/treasuryActuals';

function tx(over: Partial<TreasuryActualTransaction>): TreasuryActualTransaction {
  return {
    id: over.id ?? 't',
    companyId: 'c1',
    date: over.date ?? '2026-04-15',
    type: over.type ?? 'income',
    amount: over.amount ?? 100,
    description: '',
    categoryId: null,
    categoryName: null,
    cashFlowBucket: over.cashFlowBucket ?? null,
    bridgeAccountId: null,
    isInternalTransfer: over.isInternalTransfer ?? false,
    ...over,
  };
}

describe('buildTreasuryActuals', () => {
  it('skips internal transfers', () => {
    const out = buildTreasuryActuals([
      tx({ id: 'a', isInternalTransfer: true, amount: 1000 }),
      tx({ id: 'b', amount: 50, cashFlowBucket: 'revenue' }),
    ]);
    expect(out.length).toBe(1);
    expect(out[0].lines).toHaveLength(1);
    expect(out[0].lines[0].bucket).toBe('revenue');
    expect(out[0].totalInflows).toBe(50);
  });

  it('falls back to uncategorized_inflow / outflow when bucket is null', () => {
    const out = buildTreasuryActuals([
      tx({ id: 'a', type: 'income', amount: 100 }),
      tx({ id: 'b', type: 'expense', amount: 30 }),
    ]);
    const buckets = out[0].lines.map((l) => l.bucket).sort();
    expect(buckets).toEqual(['uncategorized_inflow', 'uncategorized_outflow']);
    expect(out[0].totalInflows).toBe(100);
    expect(out[0].totalOutflows).toBe(-30);
    expect(out[0].net).toBe(70);
  });

  it('aggregates by (month, bucket) with signed amounts', () => {
    const out = buildTreasuryActuals([
      tx({ id: '1', date: '2026-04-05', cashFlowBucket: 'revenue', amount: 100 }),
      tx({ id: '2', date: '2026-04-20', cashFlowBucket: 'revenue', amount: 50 }),
      tx({ id: '3', date: '2026-04-22', type: 'expense', cashFlowBucket: 'personnel', amount: 80 }),
      tx({ id: '4', date: '2026-05-10', cashFlowBucket: 'revenue', amount: 200 }),
    ]);
    expect(out).toHaveLength(2);
    const april = out[0];
    expect(april.monthKey).toBe('2026-04');
    const rev = april.lines.find((l) => l.bucket === 'revenue')!;
    expect(rev.amount).toBe(150);
    expect(rev.transactionIds.sort()).toEqual(['1', '2']);
    expect(april.net).toBe(150 - 80);
  });

  it('is dense over the requested range', () => {
    const out = buildTreasuryActuals(
      [tx({ id: '1', date: '2026-04-10', cashFlowBucket: 'revenue', amount: 100 })],
      { fromDate: '2026-03-01', toDate: '2026-05-31' },
    );
    expect(out.map((m) => m.monthKey)).toEqual(['2026-03', '2026-04', '2026-05']);
    expect(out[0].lines).toEqual([]);
    expect(out[2].lines).toEqual([]);
  });
});
