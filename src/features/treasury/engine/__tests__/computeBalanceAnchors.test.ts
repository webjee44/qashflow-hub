import { describe, it, expect } from 'vitest';
import { computeBalanceAnchors } from '../computeBalanceAnchors';

const asOf = '2026-07-07';

function net(txs: Array<{ date: string; amount: number }>, from: string, to: string) {
  return txs
    .filter(t => t.date >= from && t.date <= to)
    .reduce((s, t) => s + t.amount, 0);
}

describe('computeBalanceAnchors', () => {
  const txs = [
    { date: '2026-05-01', amount: +1000 }, // May inflow on 1st (boundary)
    { date: '2026-05-15', amount: -400 },
    { date: '2026-05-31', amount: -100 }, // May outflow on last day (boundary)
    { date: '2026-06-10', amount: +2000 },
    { date: '2026-06-25', amount: -500 },
    { date: '2026-07-01', amount: -300 },
    { date: '2026-07-05', amount: +800 },
  ];
  const currentBalance = 10000;

  it('invariant: opening(M+1) − opening(M) = net bancaire du mois M', () => {
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-05-01', '2026-06-01', '2026-07-01'],
    });

    const openMay = anchors.get('2026-05')!.balance;
    const openJun = anchors.get('2026-06')!.balance;
    const openJul = anchors.get('2026-07')!.balance;

    expect(openJun - openMay).toBeCloseTo(net(txs, '2026-05-01', '2026-05-31'), 6);
    expect(openJul - openJun).toBeCloseTo(net(txs, '2026-06-01', '2026-06-30'), 6);
  });

  it('current-month opening = currentBalance − MTD tx', () => {
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-07-01'],
    });
    const mtd = net(txs, '2026-07-01', asOf);
    expect(anchors.get('2026-07')!.balance).toBeCloseTo(currentBalance - mtd, 6);
    expect(anchors.get('2026-07')!.source).toBe('backward_walk');
  });

  it('override on M−1 wins over backward walk', () => {
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-07-01'],
      overrides: [{ month: '2026-06-01', balance: 99999 }],
    });
    expect(anchors.get('2026-07')!.balance).toBe(99999);
    expect(anchors.get('2026-07')!.source).toBe('override');
  });

  it('noData when month starts before earliestTransactionDate', () => {
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-03-01', '2026-05-01'],
      earliestTransactionDate: '2026-05-01',
    });
    expect(anchors.get('2026-03')!.noData).toBe(true);
    expect(anchors.get('2026-03')!.source).toBe('no_data');
    expect(anchors.get('2026-05')!.noData).toBe(false);
  });

  it('override still wins over noData bound', () => {
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-03-01'],
      overrides: [{ month: '2026-02', balance: 500 }],
      earliestTransactionDate: '2026-05-01',
    });
    expect(anchors.get('2026-03')!.balance).toBe(500);
    expect(anchors.get('2026-03')!.source).toBe('override');
  });

  it('boundaries: tx on 1st and last day are included in their own month', () => {
    // opening(Jun) − opening(May) must include tx on 2026-05-01 and 2026-05-31.
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-05-01', '2026-06-01'],
    });
    const delta =
      anchors.get('2026-06')!.balance - anchors.get('2026-05')!.balance;
    expect(delta).toBeCloseTo(1000 - 400 - 100, 6);
  });

  it('future months are not anchored (hook forward-walks)', () => {
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-08-01', '2026-09-01'],
    });
    expect(anchors.has('2026-08')).toBe(false);
    expect(anchors.has('2026-09')).toBe(false);
  });
});
