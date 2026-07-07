/**
 * computeCategoryTreasuryPlan — moteur de trésorerie CATÉGORIE × MOIS.
 *
 * Cause racine adressée : `useForecasts` (~900 lignes) duplique la logique
 * de calcul du plan de trésorerie (par catégorie, projection du mois
 * courant, marche avant, réconciliation…). Objectif final (P1.b) : la page
 * consomme un moteur pur unique et le hook devient un simple adaptateur
 * data-fetch. Ce module est la cible.
 *
 * PRINCIPE — ce moteur n'invente RIEN : il compose les primitives déjà
 * testées (`computeBalanceAnchors`, `computeCurrentMonthProjection`,
 * `computeReconciliationGap`) et reproduit à l'identique les règles
 * actuelles de `useForecasts` :
 *
 *   - `forecast` par catégorie : `toTtc(stored)`, avec la règle
 *     `percent_of_revenue` (override manuel prioritaire, sinon auto-calc
 *     sur la base HT des revenus catégorisés ayant un forecast stocké).
 *   - `actual` par catégorie : montant absolu du côté income/expense
 *     matchant le type de la catégorie.
 *   - Totaux sections : `getDisplayedSectionTotals` (categorisé + uncat pour
 *     l'actual, categorisé pour la prévision — TVA hors totaux, informative).
 *   - Variation nette affichée : `getDisplayedNetVariation`.
 *   - Projection par type : passé → actual, futur → forecast, mois courant
 *     → `computeCurrentMonthProjection` (règle unique projet).
 *   - Opening : backward walk pour passé/courant (`computeBalanceAnchors`),
 *     marche avant depuis la CLÔTURE PROJETÉE du mois courant pour le futur
 *     — override sur M−1 prioritaire.
 *   - Closing : passé/futur → opening(M+1). Mois courant → 3 vues :
 *     `balance` (= opening + netActual), `forecastBalance`
 *     (= opening + rawForecastNet catégorisé), `projectedBalance`
 *     (= opening + netProjeté). Override sur M prioritaire.
 *   - Réconciliation : `computeReconciliationGap` sur les ouvertures
 *     ancrées et la variation nette AFFICHÉE côté actual.
 *
 * Le module NE MODIFIE PAS `useForecasts.ts` ni `ForecastTable.tsx` : c'est
 * l'objet du lot P1.b. Le golden test `computeCategoryTreasuryPlan.golden.test.ts`
 * verrouille la parité règle-à-règle pour la migration.
 */

import { monthKey, firstOfMonthParis } from '@/lib/finance';
import {
  toTtc,
  toHt,
  getVatFromAmount,
  calculatePercentOfRevenueForecast,
  type ForecastAmountBasis,
} from '@/lib/forecastAmounts';
import {
  computeBalanceAnchors,
  type AnchorOverride,
  type AnchorTransaction,
  type OpeningAnchor,
} from './computeBalanceAnchors';
import { computeCurrentMonthProjection } from './currentMonthProjection';
import {
  computeReconciliationGap,
  type ReconciliationGap,
} from './computeReconciliationGap';
import type { CashFlowBucket } from '../types/treasuryActuals';

// ---------- Public types ----------

export interface CategoryInput {
  id: string;
  type: 'income' | 'expense';
  vat_rate: number | null;
  forecast_mode?: 'manual' | 'percent_of_revenue' | null;
  forecast_percent?: number | null;
  is_system?: boolean | null;
}

export interface StoredForecastInput {
  categoryId: string;
  /** `YYYY-MM` or `YYYY-MM-01` (only monthKey is used). */
  monthKey: string;
  expectedAmount: number;
  amountBasis?: ForecastAmountBasis | string | null;
}

export interface CategoryActualsInput {
  categoryId: string;
  /** `YYYY-MM` or `YYYY-MM-01`. */
  monthKey: string;
  /** Absolute positive income booked on this category × month. */
  income: number;
  /** Absolute positive expense booked on this category × month. */
  expense: number;
}

export interface UncategorizedInput {
  monthKey: string;
  income: number;
  expense: number;
}

export interface BalanceOverrideInput {
  /** `YYYY-MM` or `YYYY-MM-01`. */
  monthKey: string;
  balance: number;
}

export interface ComputeCategoryTreasuryPlanInput {
  asOfDate: string | Date;
  months: Array<string | Date>;
  categories: CategoryInput[];
  storedForecasts: StoredForecastInput[];
  actuals: CategoryActualsInput[];
  uncategorized: UncategorizedInput[];
  currentBalance: number;
  anchorTransactions: AnchorTransaction[];
  balanceOverrides?: BalanceOverrideInput[];
  earliestTransactionDate?: string | Date | null;
  /** Fallback if there is no anchor and no live balance. */
  initialBalance?: number;
}

export interface CategoryComputedRow {
  categoryId: string;
  /** TTC. Includes the `percent_of_revenue` rule (manual override wins). */
  forecast: number;
  /** Absolute positive amount actually booked. */
  actual: number;
  /**
   * Projected value for the row on this month, matching the "type" of the
   * category (always ≥ 0, orientation given by the section).
   * past → actual, future → forecast, current → projection helper.
   */
  projected: number;
}

export interface SectionTotals {
  actual: number;
  forecast: number;
  projected: number;
}

export interface VatTotals {
  forecastIncome: number;
  forecastExpense: number;
  actualIncome: number;
  actualExpense: number;
  netForecast: number;
  netActual: number;
}

export interface CategoryMonthPlan {
  month: Date;
  monthKey: string;
  periodType: 'past' | 'current' | 'future';
  categories: Map<string, CategoryComputedRow>;
  uncategorized: { income: number; expense: number };
  income: SectionTotals;
  expense: SectionTotals;
  net: SectionTotals;
  vat: VatTotals;
  opening: { balance: number; isActual: boolean; noData?: boolean };
  closing: {
    balance: number;
    /** Only defined for the current month. */
    forecastBalance?: number;
    /** Only defined for the current month. */
    projectedBalance?: number;
    isActual: boolean;
    noData?: boolean;
  };
  reconciliationGap: ReconciliationGap | null;
}

export interface CategoryTreasuryPlan {
  months: CategoryMonthPlan[];
  byMonth: Map<string, CategoryMonthPlan>;
}

// ---------- Internal helpers ----------

function mk(v: string | Date): string {
  if (typeof v === 'string' && v.length === 7) return v;
  return monthKey(v);
}

function shiftMonthKey(monthKeyValue: string, delta: number): string {
  const [y, m] = monthKeyValue.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12, 0, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function periodTypeOf(target: string, current: string): 'past' | 'current' | 'future' {
  if (target < current) return 'past';
  if (target > current) return 'future';
  return 'current';
}

// ---------- Engine ----------

export function computeCategoryTreasuryPlan(
  input: ComputeCategoryTreasuryPlanInput,
): CategoryTreasuryPlan {
  const currentMk = monthKey(input.asOfDate);

  // 1. Normalize monthly grid (sorted, unique, first-of-month Paris).
  const uniqueMks: string[] = [];
  const seenMks = new Set<string>();
  for (const raw of input.months) {
    const key = typeof raw === 'string' && raw.length === 7 ? raw : monthKey(raw);
    if (!seenMks.has(key)) {
      seenMks.add(key);
      uniqueMks.push(key);
    }
  }
  uniqueMks.sort();

  // 2. Index inputs by (categoryId, monthKey).
  const storedByCatMonth = new Map<string, StoredForecastInput>();
  for (const f of input.storedForecasts) {
    storedByCatMonth.set(`${f.categoryId}::${mk(f.monthKey)}`, f);
  }
  const actualsByCatMonth = new Map<string, { income: number; expense: number }>();
  for (const a of input.actuals) {
    actualsByCatMonth.set(`${a.categoryId}::${mk(a.monthKey)}`, {
      income: a.income,
      expense: a.expense,
    });
  }
  const uncategorizedByMonth = new Map<string, { income: number; expense: number }>();
  for (const u of input.uncategorized) {
    uncategorizedByMonth.set(mk(u.monthKey), { income: u.income, expense: u.expense });
  }
  const overrideByMonth = new Map<string, number>();
  for (const o of input.balanceOverrides ?? []) {
    overrideByMonth.set(mk(o.monthKey), Number(o.balance));
  }

  const categoriesById = new Map<string, CategoryInput>();
  for (const c of input.categories) categoriesById.set(c.id, c);

  // 3. Backward-walk anchors for every past/current month + one extra month
  //    after the horizon (used for reconciliation on the last past month).
  const anchorMonths = new Set<string>(uniqueMks);
  for (const mkKey of uniqueMks) anchorMonths.add(shiftMonthKey(mkKey, 1));
  // Always include the "next after current" so future forward-walk from
  //  current-month projected closing is well-defined even when only the
  //  current month is displayed.
  anchorMonths.add(shiftMonthKey(currentMk, 1));

  const anchorOverrides: AnchorOverride[] = (input.balanceOverrides ?? []).map(
    o => ({ month: mk(o.monthKey), balance: Number(o.balance) }),
  );

  const anchorMap: Map<string, OpeningAnchor> = computeBalanceAnchors({
    currentBalance: input.currentBalance,
    transactions: input.anchorTransactions,
    asOfDate: input.asOfDate,
    months: Array.from(anchorMonths).map(m => `${m}-01`),
    overrides: anchorOverrides,
    earliestTransactionDate: input.earliestTransactionDate ?? null,
  });

  // 4. Per-category forecast (with percent_of_revenue rule) — pure helper.
  const forecastForCategoryMonth = (catId: string, monthKeyValue: string): number => {
    const cat = categoriesById.get(catId);
    if (!cat) return 0;
    const stored = storedByCatMonth.get(`${catId}::${monthKeyValue}`);

    if (
      cat.forecast_mode === 'percent_of_revenue' &&
      (cat.forecast_percent ?? 0) > 0
    ) {
      // Manual override wins.
      if (stored) return toTtc(stored.expectedAmount, stored.amountBasis, cat.vat_rate);

      // Auto-calc on HT base of ALL income categories with a stored forecast.
      let incomeHtTotal = 0;
      for (const c of input.categories) {
        if (c.type !== 'income') continue;
        const s = storedByCatMonth.get(`${c.id}::${monthKeyValue}`);
        if (!s) continue;
        incomeHtTotal += toHt(s.expectedAmount, s.amountBasis, c.vat_rate);
      }
      return calculatePercentOfRevenueForecast({
        percentage: cat.forecast_percent!,
        revenueHt: incomeHtTotal,
        vatRate: cat.vat_rate,
        outputBasis: 'ttc',
      });
    }

    return stored ? toTtc(stored.expectedAmount, stored.amountBasis, cat.vat_rate) : 0;
  };

  const actualForCategoryMonth = (catId: string, monthKeyValue: string): number => {
    const cat = categoriesById.get(catId);
    if (!cat) return 0;
    const row = actualsByCatMonth.get(`${catId}::${monthKeyValue}`);
    if (!row) return 0;
    // Fallback (rare): unknown type → sum of both, like useForecasts.
    return cat.type === 'income' ? row.income : row.expense;
  };

  // 5. Section totals (non-system categories only, matching useForecasts).
  const categorizedTotal = (
    type: 'income' | 'expense',
    monthKeyValue: string,
    kind: 'forecast' | 'actual',
  ): number => {
    let sum = 0;
    for (const c of input.categories) {
      if (c.type !== type || c.is_system) continue;
      if (kind === 'forecast') sum += forecastForCategoryMonth(c.id, monthKeyValue);
      else sum += Math.abs(actualForCategoryMonth(c.id, monthKeyValue));
    }
    return sum;
  };

  const uncategorizedFor = (type: 'income' | 'expense', monthKeyValue: string): number =>
    uncategorizedByMonth.get(monthKeyValue)?.[type] ?? 0;

  const monthProjectedByType = (
    type: 'income' | 'expense',
    monthKeyValue: string,
  ): number => {
    const catAct = categorizedTotal(type, monthKeyValue, 'actual');
    const uncat = uncategorizedFor(type, monthKeyValue);
    const catFcst = categorizedTotal(type, monthKeyValue, 'forecast');

    const period = periodTypeOf(monthKeyValue, currentMk);
    if (period === 'past') return catAct + uncat;
    if (period === 'future') return catFcst;

    // Current: single-bucket synthesis per type, using the shared helper.
    const syntheticBucket: CashFlowBucket = type === 'income' ? 'revenue' : 'fixed_expenses';
    const sign = type === 'income' ? 1 : -1;
    const { projectedByBucket } = computeCurrentMonthProjection({
      actualByBucket: { [syntheticBucket]: sign * (catAct + uncat) },
      forecastByBucket: { [syntheticBucket]: sign * catFcst },
    });
    return Math.abs(projectedByBucket[syntheticBucket] ?? 0);
  };

  const monthNetProjected = (monthKeyValue: string): number =>
    monthProjectedByType('income', monthKeyValue) -
    monthProjectedByType('expense', monthKeyValue);

  const monthNetActual = (monthKeyValue: string): number => {
    const income = categorizedTotal('income', monthKeyValue, 'actual') +
      uncategorizedFor('income', monthKeyValue);
    const expense = categorizedTotal('expense', monthKeyValue, 'actual') +
      uncategorizedFor('expense', monthKeyValue);
    return income - expense;
  };

  // 6. VAT (informational, same rules as useForecasts).
  const vatForecastFor = (type: 'income' | 'expense', monthKeyValue: string): number => {
    let sum = 0;
    for (const c of input.categories) {
      if (c.type !== type || c.is_system) continue;
      const stored = storedByCatMonth.get(`${c.id}::${monthKeyValue}`);
      if (stored) {
        sum += getVatFromAmount(stored.expectedAmount, stored.amountBasis, c.vat_rate);
      } else {
        // percent_of_revenue auto-calc → forecast is already TTC.
        const fcst = forecastForCategoryMonth(c.id, monthKeyValue);
        sum += getVatFromAmount(fcst, 'ttc', c.vat_rate);
      }
    }
    return sum;
  };

  const vatActualFor = (type: 'income' | 'expense', monthKeyValue: string): number => {
    let sum = 0;
    for (const c of input.categories) {
      if (c.type !== type || c.is_system) continue;
      const actualAbs = Math.abs(actualForCategoryMonth(c.id, monthKeyValue));
      const rate = c.vat_rate ?? 0;
      if (rate > 0) sum += (actualAbs * rate) / (1 + rate);
    }
    return sum;
  };

  // 7. Opening balance.
  const openingFor = (
    monthKeyValue: string,
  ): { balance: number; isActual: boolean; noData?: boolean } => {
    if (monthKeyValue <= currentMk) {
      const a = anchorMap.get(monthKeyValue);
      if (a) return { balance: a.balance, isActual: a.isActual, noData: a.noData || undefined };
      return { balance: 0, isActual: true, noData: true };
    }
    // Future: override on M−1 wins, then walk forward from current-month
    // PROJECTED closing (opening + projected net).
    const prevMk = shiftMonthKey(monthKeyValue, -1);
    if (overrideByMonth.has(prevMk)) {
      return { balance: overrideByMonth.get(prevMk)!, isActual: true };
    }
    const currentAnchor = anchorMap.get(currentMk);
    const openingCurrent =
      currentAnchor?.balance ?? input.currentBalance ?? input.initialBalance ?? 0;
    let balance = openingCurrent + monthNetProjected(currentMk);
    let cursor = shiftMonthKey(currentMk, 1);
    while (cursor < monthKeyValue) {
      balance += monthNetProjected(cursor);
      cursor = shiftMonthKey(cursor, 1);
    }
    return { balance, isActual: false };
  };

  // 8. Closing balance.
  const closingFor = (monthKeyValue: string): CategoryMonthPlan['closing'] => {
    const opening = openingFor(monthKeyValue);
    if (opening.noData) return { balance: 0, isActual: true, noData: true };
    if (overrideByMonth.has(monthKeyValue)) {
      return { balance: overrideByMonth.get(monthKeyValue)!, isActual: true };
    }
    if (monthKeyValue === currentMk) {
      const netActual = monthNetActual(monthKeyValue);
      const netProjected = monthNetProjected(monthKeyValue);
      const rawForecastNet =
        categorizedTotal('income', monthKeyValue, 'forecast') -
        categorizedTotal('expense', monthKeyValue, 'forecast');
      return {
        balance: opening.balance + netActual,
        forecastBalance: opening.balance + rawForecastNet,
        projectedBalance: opening.balance + netProjected,
        isActual: false,
      };
    }
    const nextOpening = openingFor(shiftMonthKey(monthKeyValue, 1));
    return {
      balance: nextOpening.balance,
      isActual: nextOpening.isActual,
      noData: nextOpening.noData,
    };
  };

  // 9. Reconciliation gaps (pure composition).
  const openingByMonth = new Map<string, { balance: number; noData?: boolean }>();
  for (const [k, v] of anchorMap.entries()) {
    openingByMonth.set(k, { balance: v.balance, noData: v.noData });
  }
  const displayedNetByMonth = new Map<string, number>();
  for (const monthKeyValue of uniqueMks) {
    displayedNetByMonth.set(monthKeyValue, monthNetActual(monthKeyValue));
  }
  const gaps = computeReconciliationGap({
    months: uniqueMks.map(m => `${m}-01`),
    openingByMonth,
    displayedNetByMonth,
    currentBalance: input.currentBalance,
    asOfDate: input.asOfDate,
  });

  // 10. Assemble per-month plan.
  const months: CategoryMonthPlan[] = [];
  const byMonth = new Map<string, CategoryMonthPlan>();

  for (const monthKeyValue of uniqueMks) {
    const period = periodTypeOf(monthKeyValue, currentMk);

    const rows = new Map<string, CategoryComputedRow>();
    for (const c of input.categories) {
      const forecast = forecastForCategoryMonth(c.id, monthKeyValue);
      const actual = Math.abs(actualForCategoryMonth(c.id, monthKeyValue));
      let projected: number;
      if (period === 'past') projected = actual;
      else if (period === 'future') projected = forecast;
      else {
        // Row-level projection uses the same helper, per-row.
        const syntheticBucket: CashFlowBucket = c.type === 'income' ? 'revenue' : 'fixed_expenses';
        const sign = c.type === 'income' ? 1 : -1;
        const { projectedByBucket } = computeCurrentMonthProjection({
          actualByBucket: { [syntheticBucket]: sign * actual },
          forecastByBucket: { [syntheticBucket]: sign * forecast },
        });
        projected = Math.abs(projectedByBucket[syntheticBucket] ?? 0);
      }
      rows.set(c.id, { categoryId: c.id, forecast, actual, projected });
    }

    const uncat = uncategorizedByMonth.get(monthKeyValue) ?? { income: 0, expense: 0 };

    const incomeSection: SectionTotals = {
      actual: categorizedTotal('income', monthKeyValue, 'actual') + uncat.income,
      forecast: categorizedTotal('income', monthKeyValue, 'forecast'),
      projected: monthProjectedByType('income', monthKeyValue),
    };
    const expenseSection: SectionTotals = {
      actual: categorizedTotal('expense', monthKeyValue, 'actual') + uncat.expense,
      forecast: categorizedTotal('expense', monthKeyValue, 'forecast'),
      projected: monthProjectedByType('expense', monthKeyValue),
    };
    const net: SectionTotals = {
      actual: incomeSection.actual - expenseSection.actual,
      forecast: incomeSection.forecast - expenseSection.forecast,
      projected: incomeSection.projected - expenseSection.projected,
    };

    const vatForecastIncome = vatForecastFor('income', monthKeyValue);
    const vatForecastExpense = vatForecastFor('expense', monthKeyValue);
    const vatActualIncome = vatActualFor('income', monthKeyValue);
    const vatActualExpense = vatActualFor('expense', monthKeyValue);
    const vat: VatTotals = {
      forecastIncome: vatForecastIncome,
      forecastExpense: vatForecastExpense,
      actualIncome: vatActualIncome,
      actualExpense: vatActualExpense,
      netForecast: vatForecastIncome - vatForecastExpense,
      netActual: vatActualIncome - vatActualExpense,
    };

    const plan: CategoryMonthPlan = {
      month: firstOfMonthParis(`${monthKeyValue}-01`),
      monthKey: monthKeyValue,
      periodType: period,
      categories: rows,
      uncategorized: uncat,
      income: incomeSection,
      expense: expenseSection,
      net,
      vat,
      opening: openingFor(monthKeyValue),
      closing: closingFor(monthKeyValue),
      reconciliationGap: gaps.get(monthKeyValue) ?? null,
    };
    months.push(plan);
    byMonth.set(monthKeyValue, plan);
  }

  return { months, byMonth };
}
