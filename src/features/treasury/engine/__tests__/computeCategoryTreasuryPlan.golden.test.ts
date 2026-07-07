/**
 * Golden parity test for computeCategoryTreasuryPlan.
 *
 * Verrouille la parité règle-à-règle avec `useForecasts` : la référence
 * "golden" est un shadow-calcul qui reproduit LITTÉRALEMENT le code du hook
 * (mêmes helpers `toTtc`/`toHt`/`getVatFromAmount`, mêmes primitives
 * moteur : `computeCurrentMonthProjection`, `computeBalanceAnchors`,
 * `computeReconciliationGap`). Toute divergence future entre les deux
 * casse ce test — c'est le contrat de non-régression pour la migration
 * P1.b (page consomme le moteur, hook devient adaptateur data-fetch).
 */

import { describe, it, expect } from 'vitest';
import {
  computeCategoryTreasuryPlan,
  type ComputeCategoryTreasuryPlanInput,
  type CategoryMonthPlan,
} from '../computeCategoryTreasuryPlan';
import { toTtc, toHt, getVatFromAmount, calculatePercentOfRevenueForecast } from '@/lib/forecastAmounts';
import { computeBalanceAnchors } from '../computeBalanceAnchors';
import { computeCurrentMonthProjection } from '../currentMonthProjection';
import { computeReconciliationGap } from '../computeReconciliationGap';

const asOf = '2026-07-15';

// -------- Fixture --------

const categories = [
  { id: 'sales',       type: 'income'  as const, vat_rate: 0.20, forecast_mode: 'manual' as const, forecast_percent: null, is_system: false },
  { id: 'other-inc',   type: 'income'  as const, vat_rate: 0.00, forecast_mode: 'manual' as const, forecast_percent: null, is_system: false },
  { id: 'rent',        type: 'expense' as const, vat_rate: 0.20, forecast_mode: 'manual' as const, forecast_percent: null, is_system: false },
  // percent_of_revenue expense with NO manual override → auto-calc
  { id: 'commissions', type: 'expense' as const, vat_rate: 0.20, forecast_mode: 'percent_of_revenue' as const, forecast_percent: 10, is_system: false },
  // percent_of_revenue expense WITH manual override → override wins
  { id: 'variable',    type: 'expense' as const, vat_rate: 0.20, forecast_mode: 'percent_of_revenue' as const, forecast_percent: 15, is_system: false },
  // system category → excluded from displayed totals but visible per-row
  { id: 'sys-vat',     type: 'expense' as const, vat_rate: 0.00, forecast_mode: 'manual' as const, forecast_percent: null, is_system: true  },
];

const storedForecasts = [
  // June (past)
  { categoryId: 'sales',     monthKey: '2026-06', expectedAmount: 12000, amountBasis: 'ttc' as const },
  { categoryId: 'other-inc', monthKey: '2026-06', expectedAmount: 500,   amountBasis: 'ttc' as const },
  { categoryId: 'rent',      monthKey: '2026-06', expectedAmount: 2400,  amountBasis: 'ttc' as const },
  { categoryId: 'variable',  monthKey: '2026-06', expectedAmount: 1000,  amountBasis: 'ttc' as const }, // manual override
  // July (current) — mix: sales stored HT to exercise toTtc conversion
  { categoryId: 'sales',     monthKey: '2026-07', expectedAmount: 10000, amountBasis: 'ht' as const },
  { categoryId: 'other-inc', monthKey: '2026-07', expectedAmount: 300,   amountBasis: 'ttc' as const },
  { categoryId: 'rent',      monthKey: '2026-07', expectedAmount: 2400,  amountBasis: 'ttc' as const },
  // no override on 'commissions' or 'variable' this month → auto-calc for both
  // August (future)
  { categoryId: 'sales',     monthKey: '2026-08', expectedAmount: 15000, amountBasis: 'ttc' as const },
  { categoryId: 'rent',      monthKey: '2026-08', expectedAmount: 2400,  amountBasis: 'ttc' as const },
  { categoryId: 'variable',  monthKey: '2026-08', expectedAmount: 2500,  amountBasis: 'ttc' as const }, // override future
];

const actuals = [
  // June actuals
  { categoryId: 'sales', monthKey: '2026-06', income: 11500, expense: 0 },
  { categoryId: 'rent',  monthKey: '2026-06', income: 0,     expense: 2400 },
  // July MTD actuals
  { categoryId: 'sales', monthKey: '2026-07', income: 6000,  expense: 0 },
  { categoryId: 'rent',  monthKey: '2026-07', income: 0,     expense: 2400 },
];

const uncategorized = [
  { monthKey: '2026-06', income: 200, expense: 150 },
  { monthKey: '2026-07', income: 50,  expense: 80 },
];

// Ledger (backward walk) — INCLUDES an ignored tx to force reconciliation gap.
// Signed: income + / expense −.
const anchorTransactions = [
  { date: '2026-05-15', amount: -120 },
  { date: '2026-06-10', amount: +11500 },
  { date: '2026-06-20', amount: -2400 },
  { date: '2026-06-22', amount: -75 },   // ignored (booked at bank, not in ledger UI)
  { date: '2026-06-25', amount: +200 },  // categorized-as-uncat income actual
  { date: '2026-06-27', amount: -150 },  // uncat expense actual
  { date: '2026-07-01', amount: -2400 },
  { date: '2026-07-05', amount: +6000 },
  { date: '2026-07-08', amount: +50 },   // uncat income actual
  { date: '2026-07-10', amount: -80 },   // uncat expense actual
  { date: '2026-07-12', amount: -30 },   // ignored MTD
];

const currentBalance = 25000; // live balance at asOf

const balanceOverrides = [
  { monthKey: '2026-06', balance: 22500 }, // sets closing(June) = 22500
];

const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

// -------- Shadow (golden reference) --------
// Reproduit LITTÉRALEMENT le code de useForecasts.

function buildGolden(): Map<string, CategoryMonthPlan> {
  const currentMk = '2026-07';
  const overrideMap = new Map(balanceOverrides.map(o => [o.monthKey, o.balance]));
  const catsById = new Map(categories.map(c => [c.id, c]));
  const storedMap = new Map(storedForecasts.map(s => [`${s.categoryId}::${s.monthKey}`, s]));
  const actualsMap = new Map(actuals.map(a => [`${a.categoryId}::${a.monthKey}`, a]));
  const uncatMap = new Map(uncategorized.map(u => [u.monthKey, u]));

  const anchorAll = computeBalanceAnchors({
    currentBalance,
    transactions: anchorTransactions,
    asOfDate: asOf,
    months: [...months, '2026-08', '2026-09', '2026-10'].map(m => `${m}-01`),
    overrides: balanceOverrides.map(o => ({ month: o.monthKey, balance: o.balance })),
  });

  const shiftMk = (mk: string, d: number) => {
    const [y, m] = mk.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + d, 1, 12, 0, 0));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const period = (mk: string): 'past' | 'current' | 'future' =>
    mk < currentMk ? 'past' : mk > currentMk ? 'future' : 'current';

  const getForecast = (catId: string, mk: string): number => {
    const c = catsById.get(catId)!;
    const stored = storedMap.get(`${catId}::${mk}`);
    if (c.forecast_mode === 'percent_of_revenue' && (c.forecast_percent ?? 0) > 0) {
      if (stored) return toTtc(stored.expectedAmount, stored.amountBasis, c.vat_rate);
      let incomeHtTotal = 0;
      for (const cc of categories) {
        if (cc.type !== 'income') continue;
        const s = storedMap.get(`${cc.id}::${mk}`);
        if (!s) continue;
        incomeHtTotal += toHt(s.expectedAmount, s.amountBasis, cc.vat_rate);
      }
      return calculatePercentOfRevenueForecast({
        percentage: c.forecast_percent!,
        revenueHt: incomeHtTotal,
        vatRate: c.vat_rate,
        outputBasis: 'ttc',
      });
    }
    return stored ? toTtc(stored.expectedAmount, stored.amountBasis, c.vat_rate) : 0;
  };

  const getActual = (catId: string, mk: string): number => {
    const c = catsById.get(catId)!;
    const row = actualsMap.get(`${catId}::${mk}`);
    if (!row) return 0;
    return c.type === 'income' ? row.income : row.expense;
  };

  const getCategorized = (type: 'income' | 'expense', mk: string, kind: 'forecast' | 'actual'): number => {
    let s = 0;
    for (const c of categories) {
      if (c.type !== type || c.is_system) continue;
      s += kind === 'forecast' ? getForecast(c.id, mk) : Math.abs(getActual(c.id, mk));
    }
    return s;
  };

  const getUncat = (type: 'income' | 'expense', mk: string) =>
    uncatMap.get(mk)?.[type] ?? 0;

  const monthProjected = (type: 'income' | 'expense', mk: string): number => {
    const catAct = getCategorized(type, mk, 'actual');
    const uncat = getUncat(type, mk);
    const catFcst = getCategorized(type, mk, 'forecast');
    const p = period(mk);
    if (p === 'past') return catAct + uncat;
    if (p === 'future') return catFcst;
    const bucket = type === 'income' ? 'revenue' : 'fixed_expenses';
    const sign = type === 'income' ? 1 : -1;
    const { projectedByBucket } = computeCurrentMonthProjection({
      actualByBucket: { [bucket]: sign * (catAct + uncat) },
      forecastByBucket: { [bucket]: sign * catFcst },
    });
    return Math.abs(projectedByBucket[bucket] ?? 0);
  };

  const monthNetProjected = (mk: string) => monthProjected('income', mk) - monthProjected('expense', mk);
  const monthNetActual = (mk: string) =>
    (getCategorized('income', mk, 'actual') + getUncat('income', mk)) -
    (getCategorized('expense', mk, 'actual') + getUncat('expense', mk));

  const openingFor = (mk: string): { balance: number; isActual: boolean; noData?: boolean } => {
    if (mk <= currentMk) {
      const a = anchorAll.get(mk);
      if (a) return { balance: a.balance, isActual: a.isActual, noData: a.noData || undefined };
      return { balance: 0, isActual: true, noData: true };
    }
    const prev = shiftMk(mk, -1);
    if (overrideMap.has(prev)) return { balance: overrideMap.get(prev)!, isActual: true };
    const currentAnchor = anchorAll.get(currentMk);
    const openingCurrent = currentAnchor?.balance ?? currentBalance;
    let balance = openingCurrent + monthNetProjected(currentMk);
    let cur = shiftMk(currentMk, 1);
    while (cur < mk) {
      balance += monthNetProjected(cur);
      cur = shiftMk(cur, 1);
    }
    return { balance, isActual: false };
  };

  const closingFor = (mk: string): CategoryMonthPlan['closing'] => {
    const opening = openingFor(mk);
    if (opening.noData) return { balance: 0, isActual: true, noData: true };
    if (overrideMap.has(mk)) return { balance: overrideMap.get(mk)!, isActual: true };
    if (mk === currentMk) {
      const netActual = monthNetActual(mk);
      const netProjected = monthNetProjected(mk);
      const rawForecastNet =
        getCategorized('income', mk, 'forecast') - getCategorized('expense', mk, 'forecast');
      return {
        balance: opening.balance + netActual,
        forecastBalance: opening.balance + rawForecastNet,
        projectedBalance: opening.balance + netProjected,
        isActual: false,
      };
    }
    const nextOpening = openingFor(shiftMk(mk, 1));
    return { balance: nextOpening.balance, isActual: nextOpening.isActual, noData: nextOpening.noData };
  };

  const openingByMonth = new Map<string, { balance: number; noData?: boolean }>();
  for (const [k, v] of anchorAll.entries()) openingByMonth.set(k, { balance: v.balance, noData: v.noData });
  const displayedNet = new Map(months.map(mk => [mk, monthNetActual(mk)] as const));
  const gaps = computeReconciliationGap({
    months: months.map(m => `${m}-01`),
    openingByMonth,
    displayedNetByMonth: displayedNet,
    currentBalance,
    asOfDate: asOf,
  });

  const out = new Map<string, CategoryMonthPlan>();
  for (const mk of months) {
    const rows = new Map<string, {
      categoryId: string; forecast: number; actual: number; projected: number;
    }>();
    for (const c of categories) {
      const fcst = getForecast(c.id, mk);
      const act = Math.abs(getActual(c.id, mk));
      const p = period(mk);
      let proj = 0;
      if (p === 'past') proj = act;
      else if (p === 'future') proj = fcst;
      else {
        const bucket = c.type === 'income' ? 'revenue' : 'fixed_expenses';
        const sign = c.type === 'income' ? 1 : -1;
        const { projectedByBucket } = computeCurrentMonthProjection({
          actualByBucket: { [bucket]: sign * act },
          forecastByBucket: { [bucket]: sign * fcst },
        });
        proj = Math.abs(projectedByBucket[bucket] ?? 0);
      }
      rows.set(c.id, { categoryId: c.id, forecast: fcst, actual: act, projected: proj });
    }

    const uncat = uncatMap.get(mk) ?? { income: 0, expense: 0 };
    const vatFcst = (type: 'income' | 'expense') => {
      let s = 0;
      for (const c of categories) {
        if (c.type !== type || c.is_system) continue;
        const stored = storedMap.get(`${c.id}::${mk}`);
        if (stored) s += getVatFromAmount(stored.expectedAmount, stored.amountBasis, c.vat_rate);
        else s += getVatFromAmount(getForecast(c.id, mk), 'ttc', c.vat_rate);
      }
      return s;
    };
    const vatAct = (type: 'income' | 'expense') => {
      let s = 0;
      for (const c of categories) {
        if (c.type !== type || c.is_system) continue;
        const a = Math.abs(getActual(c.id, mk));
        const r = c.vat_rate ?? 0;
        if (r > 0) s += (a * r) / (1 + r);
      }
      return s;
    };
    const vFI = vatFcst('income');
    const vFE = vatFcst('expense');
    const vAI = vatAct('income');
    const vAE = vatAct('expense');

    const income = {
      actual: getCategorized('income', mk, 'actual') + uncat.income,
      forecast: getCategorized('income', mk, 'forecast'),
      projected: monthProjected('income', mk),
    };
    const expense = {
      actual: getCategorized('expense', mk, 'actual') + uncat.expense,
      forecast: getCategorized('expense', mk, 'forecast'),
      projected: monthProjected('expense', mk),
    };
    const plan: CategoryMonthPlan = {
      month: new Date(`${mk}-01T12:00:00Z`),
      monthKey: mk,
      periodType: period(mk),
      categories: rows,
      uncategorized: uncat,
      income,
      expense,
      net: {
        actual: income.actual - expense.actual,
        forecast: income.forecast - expense.forecast,
        projected: income.projected - expense.projected,
      },
      vat: {
        forecastIncome: vFI, forecastExpense: vFE,
        actualIncome: vAI, actualExpense: vAE,
        netForecast: vFI - vFE, netActual: vAI - vAE,
      },
      opening: openingFor(mk),
      closing: closingFor(mk),
      reconciliationGap: gaps.get(mk) ?? null,
    };
    out.set(mk, plan);
  }
  return out;
}

// -------- Tests --------

const input: ComputeCategoryTreasuryPlanInput = {
  asOfDate: asOf,
  months,
  categories,
  storedForecasts,
  actuals,
  uncategorized,
  currentBalance,
  anchorTransactions,
  balanceOverrides,
};

describe('computeCategoryTreasuryPlan — golden parity', () => {
  const golden = buildGolden();
  const actualPlan = computeCategoryTreasuryPlan(input);

  for (const mk of months) {
    it(`matches useForecasts rules for ${mk}`, () => {
      const g = golden.get(mk)!;
      const a = actualPlan.byMonth.get(mk)!;
      expect(a.periodType).toBe(g.periodType);
      // Per-category
      for (const c of categories) {
        const gr = g.categories.get(c.id)!;
        const ar = a.categories.get(c.id)!;
        expect(ar.forecast).toBeCloseTo(gr.forecast, 6);
        expect(ar.actual).toBeCloseTo(gr.actual, 6);
        expect(ar.projected).toBeCloseTo(gr.projected, 6);
      }
      // Uncat
      expect(a.uncategorized).toEqual(g.uncategorized);
      // Sections
      for (const key of ['income', 'expense', 'net'] as const) {
        expect(a[key].actual).toBeCloseTo(g[key].actual, 6);
        expect(a[key].forecast).toBeCloseTo(g[key].forecast, 6);
        expect(a[key].projected).toBeCloseTo(g[key].projected, 6);
      }
      // VAT
      expect(a.vat.forecastIncome).toBeCloseTo(g.vat.forecastIncome, 6);
      expect(a.vat.forecastExpense).toBeCloseTo(g.vat.forecastExpense, 6);
      expect(a.vat.actualIncome).toBeCloseTo(g.vat.actualIncome, 6);
      expect(a.vat.actualExpense).toBeCloseTo(g.vat.actualExpense, 6);
      expect(a.vat.netForecast).toBeCloseTo(g.vat.netForecast, 6);
      expect(a.vat.netActual).toBeCloseTo(g.vat.netActual, 6);
      // Opening / Closing
      expect(a.opening.balance).toBeCloseTo(g.opening.balance, 6);
      expect(a.opening.isActual).toBe(g.opening.isActual);
      expect(!!a.opening.noData).toBe(!!g.opening.noData);
      expect(a.closing.balance).toBeCloseTo(g.closing.balance, 6);
      expect(a.closing.isActual).toBe(g.closing.isActual);
      expect(!!a.closing.noData).toBe(!!g.closing.noData);
      if (mk === '2026-07') {
        expect(a.closing.forecastBalance!).toBeCloseTo(g.closing.forecastBalance!, 6);
        expect(a.closing.projectedBalance!).toBeCloseTo(g.closing.projectedBalance!, 6);
      }
      // Reconciliation
      if (g.reconciliationGap === null) {
        expect(a.reconciliationGap).toBeNull();
      } else {
        expect(a.reconciliationGap).not.toBeNull();
        expect(a.reconciliationGap!.gap).toBeCloseTo(g.reconciliationGap.gap, 6);
        expect(a.reconciliationGap!.isCurrent).toBe(g.reconciliationGap.isCurrent);
      }
    });
  }

  it('percent_of_revenue: auto-calc = %×Σ(incomeHT) TTC; manual override wins', () => {
    const jul = actualPlan.byMonth.get('2026-07')!;
    // Sales HT 10000 + other-inc HT 300 (vat 0) = 10300 HT.
    // Commissions 10% TTC vat 20% → 10300 × 0.10 × 1.20 = 1236.
    expect(jul.categories.get('commissions')!.forecast).toBeCloseTo(1236, 6);
    // Variable 15% TTC vat 20% → 10300 × 0.15 × 1.20 = 1854.
    expect(jul.categories.get('variable')!.forecast).toBeCloseTo(1854, 6);
    // June: 'variable' has manual override 1000 → wins over % auto-calc.
    const jun = actualPlan.byMonth.get('2026-06')!;
    expect(jun.categories.get('variable')!.forecast).toBeCloseTo(1000, 6);
  });

  it('system categories are excluded from displayed totals', () => {
    for (const mk of months) {
      const plan = actualPlan.byMonth.get(mk)!;
      const sysRow = plan.categories.get('sys-vat');
      expect(sysRow).toBeDefined();
      // Force a non-zero stored value on sys-vat is not present in the fixture,
      // so section totals should NOT include it regardless.
      expect(sysRow!.forecast).toBe(0);
    }
  });
});

describe('computeCategoryTreasuryPlan — invariants', () => {
  const plan = computeCategoryTreasuryPlan(input);

  it('idempotence: two calls produce identical outputs', () => {
    const plan2 = computeCategoryTreasuryPlan(input);
    for (const mk of months) {
      const a = plan.byMonth.get(mk)!;
      const b = plan2.byMonth.get(mk)!;
      expect(a.opening.balance).toBe(b.opening.balance);
      expect(a.closing.balance).toBe(b.closing.balance);
      expect(a.net.projected).toBe(b.net.projected);
    }
  });

  it('future months: opening(M) + netProjected(M) = closing.balance(M) = opening(M+1)', () => {
    const futureMonths = ['2026-08', '2026-09'];
    for (const mk of futureMonths) {
      const p = plan.byMonth.get(mk)!;
      expect(p.closing.balance).toBeCloseTo(p.opening.balance + p.net.projected, 6);
    }
    // Chain: closing(Aug) === opening(Sep)
    expect(plan.byMonth.get('2026-08')!.closing.balance)
      .toBeCloseTo(plan.byMonth.get('2026-09')!.opening.balance, 6);
  });

  it('reconciliation = 0 when the whole ledger is visible (no ignored txs)', () => {
    // Ledger fully visible → each month's bank net matches the displayed net.
    // Keep only txs that map to categorized actuals or uncategorized entries
    // present in the fixture (June & July). Drop the stray May tx and both
    // ignored txs. Remove the override so closings truly follow the bank.
    const txsClean = anchorTransactions.filter(t =>
      t.date !== '2026-05-15' && t.date !== '2026-06-22' && t.date !== '2026-07-12',
    );
    const cleanPlan = computeCategoryTreasuryPlan({
      ...input,
      anchorTransactions: txsClean,
      balanceOverrides: [],
    });
    for (const mk of ['2026-06', '2026-07']) {
      const p = cleanPlan.byMonth.get(mk)!;
      expect(p.reconciliationGap).not.toBeNull();
      expect(p.reconciliationGap!.gap).toBeCloseTo(0, 6);
    }
  });
});
