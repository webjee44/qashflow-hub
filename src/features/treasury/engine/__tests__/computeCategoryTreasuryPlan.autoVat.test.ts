/**
 * Auto-VAT tests for computeCategoryTreasuryPlan.
 *
 * Contract:
 *   - A category with forecast_mode='auto_vat' becomes a real cash-flow
 *     line whose forecast is derived from the VAT collected / deductible
 *     of the other categories, following the company's `vatRegime`.
 *   - Monthly regime: net VAT of month P is paid in P+1.
 *   - Quarterly regime: net VAT of a civil quarter is paid the month
 *     right after the end of the quarter (Apr/Jul/Oct/Jan).
 *   - Negative net (credit) rolls over: no payment that period, and the
 *     |credit| reduces the next period's payment first.
 *   - A manually stored forecast on the auto_vat category ALWAYS wins.
 *   - The auto_vat category is excluded from its own VAT base (no
 *     recursion, no double-counting). is_system cats and vat_rate=0
 *     cats naturally contribute 0.
 *   - Regime 'none' (or unset) → no scheduled flow.
 */

import { describe, it, expect } from 'vitest';
import {
  computeCategoryTreasuryPlan,
  type ComputeCategoryTreasuryPlanInput,
  type CategoryInput,
} from '../computeCategoryTreasuryPlan';

// Every test uses the SAME categories block: one income cat @20 %, one
// expense cat @20 %, and the auto_vat expense category itself. The engine
// must exclude the auto_vat cat from the VAT base regardless of its rate.
const CATEGORIES: CategoryInput[] = [
  { id: 'sales', type: 'income', vat_rate: 0.20, forecast_mode: 'manual', forecast_percent: null, is_system: false },
  { id: 'rent',  type: 'expense', vat_rate: 0.20, forecast_mode: 'manual', forecast_percent: null, is_system: false },
  { id: 'vat',   type: 'expense', vat_rate: 0.00, forecast_mode: 'auto_vat', forecast_percent: null, is_system: false },
];

/** Minimal input builder — no anchors, no actuals, no uncat, no live balance. */
function makeInput(
  overrides: Partial<ComputeCategoryTreasuryPlanInput>,
): ComputeCategoryTreasuryPlanInput {
  return {
    asOfDate: '2026-01-15',
    months: ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'],
    categories: CATEGORIES,
    storedForecasts: [],
    actuals: [],
    uncategorized: [],
    currentBalance: 0,
    anchorTransactions: [],
    ...overrides,
  };
}

const vatFcstOn = (plan: ReturnType<typeof computeCategoryTreasuryPlan>, mk: string) =>
  plan.byMonth.get(mk)?.categories.get('vat')?.forecast ?? 0;

describe('auto_vat — monthly regime', () => {
  it('pays net VAT of month P in month P+1 (all future months)', () => {
    // asOf = 2026-01-15 → currentMk = '2026-01'. All target months below
    // are future so forecast side is used for the VAT base.
    // February: 10 000 TTC sales @20% → 1 666.67 collected; rent 1 200 TTC
    // @20% → 200 deductible. Net = 1 466.67. Paid in March.
    const input = makeInput({
      vatRegime: 'monthly',
      storedForecasts: [
        { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 10000, amountBasis: 'ttc' },
        { categoryId: 'rent',  monthKey: '2026-02', expectedAmount: 1200,  amountBasis: 'ttc' },
      ],
    });
    const plan = computeCategoryTreasuryPlan(input);

    // February itself: no payment scheduled here (would be for January's net).
    expect(vatFcstOn(plan, '2026-02')).toBeCloseTo(0, 6);
    // March: 1 466.67 payment.
    expect(vatFcstOn(plan, '2026-03')).toBeCloseTo(10000 / 6 - 200, 6);
  });

  it('carries forward a VAT credit onto the following months', () => {
    // Feb: 6 000 sales @20% (1 000 collected), 12 000 rent @20% (2 000 deductible).
    //   → net = -1 000  → March payment 0, credit = 1 000.
    // Mar: 6 000 sales, 0 rent → net = 1 000 → April payment = max(0, 1000-1000) = 0, credit = 0.
    // Apr: 12 000 sales, 0 rent → net = 2 000 → May payment = 2 000.
    const input = makeInput({
      vatRegime: 'monthly',
      storedForecasts: [
        { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 6000,  amountBasis: 'ttc' },
        { categoryId: 'rent',  monthKey: '2026-02', expectedAmount: 12000, amountBasis: 'ttc' },
        { categoryId: 'sales', monthKey: '2026-03', expectedAmount: 6000,  amountBasis: 'ttc' },
        { categoryId: 'sales', monthKey: '2026-04', expectedAmount: 12000, amountBasis: 'ttc' },
      ],
    });
    const plan = computeCategoryTreasuryPlan(input);
    expect(vatFcstOn(plan, '2026-03')).toBeCloseTo(0, 6);
    expect(vatFcstOn(plan, '2026-04')).toBeCloseTo(0, 6);
    expect(vatFcstOn(plan, '2026-05')).toBeCloseTo(2000, 6);
  });

  it('lets a manually stored forecast on the auto_vat category override the scheduled value', () => {
    const input = makeInput({
      vatRegime: 'monthly',
      storedForecasts: [
        { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 10000, amountBasis: 'ttc' },
        // Manual override for March (would be 1666.67 without it).
        { categoryId: 'vat',   monthKey: '2026-03', expectedAmount: 500,   amountBasis: 'ttc' },
      ],
    });
    const plan = computeCategoryTreasuryPlan(input);
    expect(vatFcstOn(plan, '2026-03')).toBeCloseTo(500, 6);
  });
});

describe('auto_vat — quarterly regime', () => {
  it('pays Q1 (Jan+Feb+Mar) net in April', () => {
    // Q1 sales: 3 000 + 6 000 + 9 000 = 18 000 TTC @20% → 3 000 collected.
    // Q1 rent : 0. Net = 3 000. Paid April.
    const input = makeInput({
      vatRegime: 'quarterly',
      storedForecasts: [
        { categoryId: 'sales', monthKey: '2026-01', expectedAmount: 3000, amountBasis: 'ttc' },
        { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 6000, amountBasis: 'ttc' },
        { categoryId: 'sales', monthKey: '2026-03', expectedAmount: 9000, amountBasis: 'ttc' },
      ],
    });
    const plan = computeCategoryTreasuryPlan(input);
    expect(vatFcstOn(plan, '2026-02')).toBeCloseTo(0, 6);
    expect(vatFcstOn(plan, '2026-03')).toBeCloseTo(0, 6);
    expect(vatFcstOn(plan, '2026-04')).toBeCloseTo(3000, 6);
    expect(vatFcstOn(plan, '2026-05')).toBeCloseTo(0, 6);
  });

  it('never schedules a payment outside {Apr, Jul, Oct, Jan}', () => {
    const input = makeInput({
      vatRegime: 'quarterly',
      months: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'],
      storedForecasts: [
        { categoryId: 'sales', monthKey: '2026-01', expectedAmount: 1200, amountBasis: 'ttc' },
        { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 1200, amountBasis: 'ttc' },
        { categoryId: 'sales', monthKey: '2026-03', expectedAmount: 1200, amountBasis: 'ttc' },
        { categoryId: 'sales', monthKey: '2026-04', expectedAmount: 1200, amountBasis: 'ttc' },
      ],
    });
    const plan = computeCategoryTreasuryPlan(input);
    for (const m of ['2026-02', '2026-03', '2026-05', '2026-06']) {
      expect(vatFcstOn(plan, m)).toBe(0);
    }
    expect(vatFcstOn(plan, '2026-04')).toBeGreaterThan(0);
    expect(vatFcstOn(plan, '2026-07')).toBeGreaterThan(0);
  });
});

describe('auto_vat — regime none / recursion guard', () => {
  it('regime "none" yields no auto payment', () => {
    const input = makeInput({
      vatRegime: 'none',
      storedForecasts: [
        { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 10000, amountBasis: 'ttc' },
      ],
    });
    const plan = computeCategoryTreasuryPlan(input);
    for (const m of ['2026-02', '2026-03', '2026-04']) {
      expect(vatFcstOn(plan, m)).toBe(0);
    }
  });

  it('unset regime falls back to no auto payment', () => {
    const plan = computeCategoryTreasuryPlan(
      makeInput({
        storedForecasts: [
          { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 10000, amountBasis: 'ttc' },
        ],
      }),
    );
    expect(vatFcstOn(plan, '2026-03')).toBe(0);
  });

  it('excludes the auto_vat category itself from the VAT base (no self-feedback)', () => {
    // A stored forecast on the auto_vat cat MUST NOT re-enter the base;
    // it acts as an override for the payment month only.
    // Feb: 10 000 sales @20% → 1 666.67 collected. Rent absent.
    // Also seed a bogus forecast on the auto_vat cat for Feb that would,
    // if counted, add fake deductible VAT — the March payment must
    // NEVERTHELESS equal 1 666.67 exactly.
    const input = makeInput({
      vatRegime: 'monthly',
      storedForecasts: [
        { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 10000, amountBasis: 'ttc' },
        // "vat" cat has vat_rate=0 so it produces 0 VAT anyway, but we
        // also assert the recursion guard by putting a stored forecast:
        { categoryId: 'vat',   monthKey: '2026-02', expectedAmount: 9999, amountBasis: 'ttc' },
      ],
    });
    const plan = computeCategoryTreasuryPlan(input);
    // The Feb override on 'vat' is for the Feb row itself; March row is
    // driven by the auto schedule from Feb source period (unaffected).
    expect(vatFcstOn(plan, '2026-03')).toBeCloseTo(10000 / 6, 6);
  });

  it('OFF-mode: without any auto_vat category, results are identical whatever the regime', () => {
    const catsNoAuto: CategoryInput[] = CATEGORIES.filter(c => c.forecast_mode !== 'auto_vat');
    const base = makeInput({
      categories: catsNoAuto,
      storedForecasts: [
        { categoryId: 'sales', monthKey: '2026-02', expectedAmount: 10000, amountBasis: 'ttc' },
        { categoryId: 'rent',  monthKey: '2026-02', expectedAmount: 1200,  amountBasis: 'ttc' },
      ],
    });
    const none = computeCategoryTreasuryPlan({ ...base, vatRegime: 'none' });
    const monthly = computeCategoryTreasuryPlan({ ...base, vatRegime: 'monthly' });
    const quarterly = computeCategoryTreasuryPlan({ ...base, vatRegime: 'quarterly' });
    for (const mk of ['2026-02', '2026-03', '2026-04']) {
      const a = none.byMonth.get(mk)!;
      const b = monthly.byMonth.get(mk)!;
      const c = quarterly.byMonth.get(mk)!;
      expect(a.expense.forecast).toBeCloseTo(b.expense.forecast, 6);
      expect(a.expense.forecast).toBeCloseTo(c.expense.forecast, 6);
      expect(a.income.forecast).toBeCloseTo(b.income.forecast, 6);
    }
  });
});
