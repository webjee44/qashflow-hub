import { describe, it, expect } from 'vitest';
import { computeReconciliationGap } from '../computeReconciliationGap';
import { computeBalanceAnchors } from '../computeBalanceAnchors';

const asOf = '2026-07-07';

describe('computeReconciliationGap', () => {
  it('écart = 0 quand les flux affichés couvrent tout le ledger', () => {
    // Ledger complet visible : displayedNet == bank delta pour chaque mois.
    const txs = [
      { date: '2026-05-10', amount: +1000 },
      { date: '2026-05-20', amount: -400 },
      { date: '2026-06-05', amount: +2000 },
      { date: '2026-06-25', amount: -500 },
      { date: '2026-07-03', amount: -300 },
    ];
    const currentBalance = 10000;
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-05-01', '2026-06-01', '2026-07-01'],
    });

    // Sums signés par mois (identiques à displayed puisque tout est visible).
    const netByMonth = new Map<string, number>([
      ['2026-05', 1000 - 400],
      ['2026-06', 2000 - 500],
      ['2026-07', -300], // MTD à asOf
    ]);

    const gaps = computeReconciliationGap({
      months: ['2026-05-01', '2026-06-01', '2026-07-01'],
      openingByMonth: anchors,
      displayedNetByMonth: netByMonth,
      currentBalance,
      asOfDate: asOf,
    });

    expect(gaps.get('2026-05')!.gap).toBeCloseTo(0, 6);
    expect(gaps.get('2026-06')!.gap).toBeCloseTo(0, 6);
    expect(gaps.get('2026-07')!.gap).toBeCloseTo(0, 6);
    expect(gaps.get('2026-07')!.isCurrent).toBe(true);
    expect(gaps.get('2026-05')!.isCurrent).toBe(false);
  });

  it('écart = somme signée des tx is_ignored quand elles sont la seule divergence', () => {
    // Ledger (backward walk) inclut TOUTES les tx.
    const allTxs = [
      { date: '2026-05-10', amount: +1000 },
      { date: '2026-05-15', amount: -150 }, // ignorée
      { date: '2026-05-20', amount: -400 },
      { date: '2026-06-05', amount: +2000 },
      { date: '2026-06-12', amount: +75 },  // ignorée
      { date: '2026-06-25', amount: -500 },
      { date: '2026-07-03', amount: -300 },
      { date: '2026-07-06', amount: -40 },  // ignorée (MTD)
    ];
    const ignored = new Set(['2026-05-15', '2026-06-12', '2026-07-06']);
    const currentBalance = 10000;

    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: allTxs,
      asOfDate: asOf,
      months: ['2026-05-01', '2026-06-01', '2026-07-01'],
    });

    // Displayed net = ledger MOINS les ignorées.
    const netByMonth = new Map<string, number>();
    for (const mk of ['2026-05', '2026-06', '2026-07']) {
      const sum = allTxs
        .filter(t => t.date.startsWith(mk) && !ignored.has(t.date))
        .reduce((s, t) => s + t.amount, 0);
      netByMonth.set(mk, sum);
    }

    const gaps = computeReconciliationGap({
      months: ['2026-05-01', '2026-06-01', '2026-07-01'],
      openingByMonth: anchors,
      displayedNetByMonth: netByMonth,
      currentBalance,
      asOfDate: asOf,
    });

    // Chaque écart = somme signée des ignorées du mois.
    expect(gaps.get('2026-05')!.gap).toBeCloseTo(-150, 6);
    expect(gaps.get('2026-06')!.gap).toBeCloseTo(+75, 6);
    expect(gaps.get('2026-07')!.gap).toBeCloseTo(-40, 6);
    expect(gaps.get('2026-07')!.isCurrent).toBe(true);
  });

  it('mois courant : écart à date (MTD)', () => {
    const txs = [
      { date: '2026-07-01', amount: -300 },
      { date: '2026-07-05', amount: +800 },
      { date: '2026-07-06', amount: -50 }, // ignorée
    ];
    const currentBalance = 10000;
    const anchors = computeBalanceAnchors({
      currentBalance,
      transactions: txs,
      asOfDate: asOf,
      months: ['2026-07-01'],
    });
    const gaps = computeReconciliationGap({
      months: ['2026-07-01'],
      openingByMonth: anchors,
      displayedNetByMonth: new Map([['2026-07', -300 + 800]]), // affiché sans ignorée
      currentBalance,
      asOfDate: asOf,
    });
    const g = gaps.get('2026-07')!;
    expect(g.isCurrent).toBe(true);
    // MTD bank net = currentBalance − opening = Σ tx MTD (incl. ignorée) = 450
    // displayed = 500 → écart = -50 (l'ignorée).
    expect(g.gap).toBeCloseTo(-50, 6);
  });

  it('mois noData → pas d\'écart calculé', () => {
    const anchors = new Map([
      ['2026-03', { balance: 0, noData: true }],
      ['2026-04', { balance: 5000, noData: false }],
    ]);
    const gaps = computeReconciliationGap({
      months: ['2026-03-01', '2026-04-01'],
      openingByMonth: anchors,
      displayedNetByMonth: new Map([['2026-03', 0], ['2026-04', 100]]),
      currentBalance: 10000,
      asOfDate: asOf,
    });
    expect(gaps.has('2026-03')).toBe(false);
    // 2026-04 sans next ancre → pas d'écart calculable.
    expect(gaps.has('2026-04')).toBe(false);
  });

  it('mois futurs ignorés', () => {
    const anchors = new Map([['2026-07', { balance: 5000 }]]);
    const gaps = computeReconciliationGap({
      months: ['2026-08-01', '2026-09-01'],
      openingByMonth: anchors,
      displayedNetByMonth: new Map(),
      currentBalance: 10000,
      asOfDate: asOf,
    });
    expect(gaps.size).toBe(0);
  });

  it('mois passé sans ancre next → pas d\'écart (bord d\'horizon)', () => {
    const anchors = new Map([
      ['2026-05', { balance: 3000 }],
      // pas de 2026-06
    ]);
    const gaps = computeReconciliationGap({
      months: ['2026-05-01'],
      openingByMonth: anchors,
      displayedNetByMonth: new Map([['2026-05', 500]]),
      currentBalance: 10000,
      asOfDate: asOf,
    });
    expect(gaps.has('2026-05')).toBe(false);
  });
});
