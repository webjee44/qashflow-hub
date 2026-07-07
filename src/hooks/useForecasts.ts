import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { useCategories } from './useCategories';
import { toast } from 'sonner';
import { addMonths, startOfMonth, endOfMonth, format, isBefore } from 'date-fns';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { toHt } from '@/lib/forecastAmounts';
import {
  computeCategoryTreasuryPlan,
  type ComputeCategoryTreasuryPlanInput,
  type CategoryMonthPlan,
} from '@/features/treasury/engine/computeCategoryTreasuryPlan';
import { monthKey as toMonthKey } from '@/lib/finance';
import type { ReconciliationGap } from '@/features/treasury/engine/computeReconciliationGap';

// ============================================================================
// useForecasts — ADAPTER
// ----------------------------------------------------------------------------
// P1.b : ce hook est un pur adaptateur data-fetch. Il :
//   1. exécute les React Query (category_forecasts, actuals, uncategorized,
//      payables, balance_overrides, anchor-walk, live balance) — INCHANGÉES,
//   2. mappe leurs résultats vers l'input du moteur pur,
//   3. appelle `computeCategoryTreasuryPlan` UNE fois via useMemo,
//   4. expose la même API publique qu'avant, désormais implémentée comme de
//      simples lectures dans le plan retourné par le moteur.
//
// AUCUNE règle de calcul métier ne vit plus ici (percent_of_revenue,
// projection du mois courant, marche des soldes, agrégats TVA, réconciliation
// bancaire) : tout est délégué au moteur. Le golden test
// `computeCategoryTreasuryPlan.golden.test.ts` verrouille la parité.
//
// Divergences connues avec l'ancienne implémentation (à signaler, PAS à
// corriger silencieusement) :
//   - L'ancien `getMonthNetActual` (utilisé pour calculer l'écart bancaire)
//     ne filtrait PAS `is_system`. Le moteur les exclut. En pratique, aucune
//     catégorie système ne porte des transactions dans le SaaS actuel, donc
//     aucun impact numérique observé sur la base — mais la règle est
//     désormais uniforme avec les totaux de sections.
// ============================================================================

export interface PayableInvoice {
  id: string;
  due_date: string;
  amount_ttc: number;
  partner_name: string;
  status: string;
  category_id: string | null;
  invoice_number: string | null;
}

export interface CategoryForecast {
  id: string;
  user_id: string;
  category_id: string;
  month: string;
  expected_amount: number;
  amount_basis?: 'ht' | 'ttc';
  notes: string | null;
  created_at: string;
  updated_at: string;
  company_id?: string | null;
  source?: 'manual' | 'bp_import' | 'bp_synced';
  bp_stream_id?: string | null;
  bp_expense_id?: string | null;
}

export interface ForecastWithActual extends CategoryForecast {
  actual_amount: number;
}

export function useForecasts() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { categories } = useCategories();
  const queryClient = useQueryClient();

  // -------- Period controls (localStorage-persisted) --------

  const todayRef = useRef(startOfMonth(new Date()));
  const today = todayRef.current;

  const MONTHS_BEFORE_KEY = 'forecast-monthsBefore';
  const MONTHS_AFTER_KEY = 'forecast-monthsAfter';

  const getStoredValue = useCallback((key: string, defaultValue: number): number => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    const parsed = parseInt(stored, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }, []);

  const [monthsBefore, setMonthsBeforeState] = useState(() => getStoredValue(MONTHS_BEFORE_KEY, 0));
  const [monthsAfter, setMonthsAfterState] = useState(() => getStoredValue(MONTHS_AFTER_KEY, 5));

  useEffect(() => {
    localStorage.setItem(MONTHS_BEFORE_KEY, String(monthsBefore));
  }, [monthsBefore]);

  useEffect(() => {
    localStorage.setItem(MONTHS_AFTER_KEY, String(monthsAfter));
  }, [monthsAfter]);

  const months = useMemo(() => {
    const result: Date[] = [];
    const startMonth = addMonths(today, -monthsBefore);
    const totalMonths = monthsBefore + 1 + monthsAfter;
    for (let i = 0; i < totalMonths; i++) {
      result.push(addMonths(startMonth, i));
    }
    return result;
  }, [today, monthsBefore, monthsAfter]);

  const extendBefore = useCallback(() => setMonthsBeforeState(prev => prev + 1), []);
  const extendAfter = useCallback(() => setMonthsAfterState(prev => prev + 1), []);
  const shrinkBefore = useCallback(() => setMonthsBeforeState(prev => Math.max(0, prev - 1)), []);
  const shrinkAfter = useCallback(() => setMonthsAfterState(prev => Math.max(0, prev - 1)), []);
  const resetPeriod = useCallback(() => {
    setMonthsBeforeState(0);
    setMonthsAfterState(5);
  }, []);

  const startMonthStr = months.length > 0 ? format(months[0], 'yyyy-MM-01') : '';
  const endMonthStr = months.length > 0 ? format(months[months.length - 1], 'yyyy-MM-01') : '';

  // -------- Data queries (unchanged) --------

  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['category-forecasts', user?.id, currentCompany?.id, startMonthStr, endMonthStr],
    queryFn: async () => {
      if (!user?.id || !startMonthStr) return [];
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('category_forecasts')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('month', startMonthStr)
        .lte('month', endMonthStr)
        .order('month');
      if (error) throw error;
      return data as CategoryForecast[];
    },
    enabled: !!user?.id && !!startMonthStr,
  });

  const { data: actuals = {}, isLoading: actualsLoading } = useQuery({
    queryKey: ['category-actuals', user?.id, currentCompany?.id, startMonthStr, endMonthStr],
    queryFn: async () => {
      if (!user?.id || !startMonthStr) return {};
      const endMonthPlusOne = format(addMonths(months[months.length - 1], 1), 'yyyy-MM-01');
      if (!currentCompany?.id) return {};
      const { data, error } = await supabase
        .from('transactions')
        .select('category_id, amount, date, type')
        .eq('company_id', currentCompany.id)
        .gte('date', startMonthStr)
        .lt('date', endMonthPlusOne)
        .is('deleted_at', null)
        .or('is_ignored.is.null,is_ignored.eq.false');
      if (error) throw error;

      const grouped: Record<string, Record<string, { income: number; expense: number }>> = {};
      data?.forEach((tx) => {
        if (!tx.category_id) return;
        const monthKey = format(new Date(tx.date), 'yyyy-MM-01');
        if (!grouped[tx.category_id]) grouped[tx.category_id] = {};
        if (!grouped[tx.category_id][monthKey]) grouped[tx.category_id][monthKey] = { income: 0, expense: 0 };
        const amount = Number(tx.amount);
        if (tx.type === 'income') grouped[tx.category_id][monthKey].income += amount;
        else grouped[tx.category_id][monthKey].expense += amount;
      });
      return grouped;
    },
    enabled: !!user?.id && !!startMonthStr,
  });

  const { data: uncategorized = {}, isLoading: uncategorizedLoading } = useQuery({
    queryKey: ['uncategorized-transactions', user?.id, currentCompany?.id, startMonthStr, endMonthStr],
    queryFn: async () => {
      if (!user?.id || !startMonthStr) return {};
      const endMonthPlusOne = format(addMonths(months[months.length - 1], 1), 'yyyy-MM-01');
      if (!currentCompany?.id) return {};
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, date, type')
        .eq('company_id', currentCompany.id)
        .gte('date', startMonthStr)
        .lt('date', endMonthPlusOne)
        .is('category_id', null)
        .is('deleted_at', null)
        .or('is_ignored.is.null,is_ignored.eq.false');
      if (error) throw error;

      const grouped: Record<string, { income: number; expense: number }> = {};
      data?.forEach((tx) => {
        const monthKey = format(new Date(tx.date), 'yyyy-MM-01');
        if (!grouped[monthKey]) grouped[monthKey] = { income: 0, expense: 0 };
        const amount = Math.abs(Number(tx.amount));
        if (tx.type === 'income') grouped[monthKey].income += amount;
        else grouped[monthKey].expense += amount;
      });
      return grouped;
    },
    enabled: !!user?.id && !!startMonthStr,
  });

  const { data: payableInvoices = [], isLoading: payablesLoading } = useQuery({
    queryKey: ['payable-invoices', user?.id, currentCompany?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, due_date, amount_ttc, partner_name, status, category_id, invoice_number')
        .eq('company_id', currentCompany.id)
        .eq('type', 'payable')
        .eq('status', 'pending')
        .order('due_date');
      if (error) throw error;
      return data as PayableInvoice[];
    },
    enabled: !!user?.id,
  });

  // Backward-walk anchor data (SIGNED bank movements, includes is_ignored)
  const { data: anchorWalkData } = useQuery({
    queryKey: ['balance-anchor-walk', currentCompany?.id, startMonthStr],
    queryFn: async () => {
      if (!currentCompany?.id || !startMonthStr) {
        return { transactions: [] as Array<{ date: string; amount: number }>, earliestDate: null as string | null };
      }
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const { data: activeAccounts, error: accErr } = await supabase
        .from('company_active_bridge_accounts')
        .select('bridge_account_id')
        .eq('company_id', currentCompany.id);
      if (accErr) throw accErr;
      const activeIds = (activeAccounts ?? [])
        .map(a => (a as { bridge_account_id: number | null }).bridge_account_id)
        .filter((v): v is number => v != null);

      const pageSize = 1000;
      const rows: Array<{ date: string; amount: number; type: string; bridge_account_id: number | null }> = [];
      let from = 0;
      for (let page = 0; page < 20; page++) {
        let q = supabase
          .from('transactions')
          .select('date, amount, type, bridge_account_id')
          .eq('company_id', currentCompany.id)
          .is('deleted_at', null)
          .gte('date', startMonthStr)
          .lte('date', todayStr)
          .order('date', { ascending: true })
          .range(from, from + pageSize - 1);
        if (activeIds.length > 0) q = q.in('bridge_account_id', activeIds);
        const { data, error } = await q;
        if (error) throw error;
        const chunk = (data ?? []) as typeof rows;
        rows.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      const transactions = rows.map(r => ({
        date: r.date,
        amount: r.type === 'income' ? Math.abs(Number(r.amount)) : -Math.abs(Number(r.amount)),
      }));

      const { data: earliest, error: earliestErr } = await supabase
        .from('transactions')
        .select('date')
        .eq('company_id', currentCompany.id)
        .is('deleted_at', null)
        .order('date', { ascending: true })
        .limit(1);
      if (earliestErr) throw earliestErr;
      const earliestDate = earliest?.[0]?.date ?? null;

      return { transactions, earliestDate };
    },
    enabled: !!currentCompany?.id && !!startMonthStr,
    staleTime: 30 * 1000,
  });

  const { data: balanceOverrides = [] } = useQuery({
    queryKey: ['balance-overrides', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('balance_overrides')
        .select('id, month, balance')
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      return (data || []) as { id: string; month: string; balance: number }[];
    },
    enabled: !!currentCompany?.id,
  });

  const { data: liveBankBalance } = useQuery({
    queryKey: ['live-bank-balance', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data: accounts, error } = await supabase
        .from('company_active_bridge_accounts')
        .select('balance')
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      if (!accounts || accounts.length === 0) return null;
      return accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
    },
    enabled: !!currentCompany?.id,
    staleTime: 30 * 1000,
  });

  // -------- Mutations (unchanged) --------

  const upsertForecast = useMutation({
    mutationFn: async ({ categoryId, month, expectedAmount }: {
      categoryId: string; month: Date; expectedAmount: number;
    }) => {
      if (!user?.id || !currentCompany) throw new Error('Non authentifié ou pas de société');
      const dataOwnerId = currentCompany.user_id;
      const monthStr = format(month, 'yyyy-MM-01');
      const { data, error } = await supabase
        .from('category_forecasts')
        .upsert({
          user_id: dataOwnerId,
          category_id: categoryId,
          month: monthStr,
          expected_amount: expectedAmount,
          company_id: currentCompany.id,
          amount_basis: 'ttc',
        } as never, { onConflict: 'user_id,category_id,month' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-forecasts'] });
    },
    onError: (error) => {
      toast.error('Erreur lors de la sauvegarde: ' + error.message);
    },
  });

  const clearForecastOverride = useMutation({
    mutationFn: async ({ categoryId, month }: { categoryId: string; month: Date }) => {
      if (!user?.id || !currentCompany) throw new Error('Non authentifié');
      const monthStr = format(month, 'yyyy-MM-01');
      const dataOwnerId = currentCompany.user_id;
      const { error } = await supabase
        .from('category_forecasts')
        .delete()
        .eq('user_id', dataOwnerId)
        .eq('category_id', categoryId)
        .eq('month', monthStr);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-forecasts'] });
      toast.success('Calcul automatique rétabli');
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const upsertBalanceOverride = useMutation({
    mutationFn: async ({ month, balance }: { month: Date; balance: number }) => {
      if (!user?.id || !currentCompany?.id) throw new Error('Non authentifié');
      const monthStr = format(month, 'yyyy-MM-01');
      const { error } = await supabase
        .from('balance_overrides')
        .upsert({
          company_id: currentCompany.id,
          user_id: currentCompany.user_id,
          month: monthStr,
          balance,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,month' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance-overrides'] });
      toast.success('Solde de fin de mois mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const deleteBalanceOverride = useMutation({
    mutationFn: async ({ month }: { month: Date }) => {
      if (!currentCompany?.id) throw new Error('Non authentifié');
      const monthStr = format(month, 'yyyy-MM-01');
      const { error } = await supabase
        .from('balance_overrides')
        .delete()
        .eq('company_id', currentCompany.id)
        .eq('month', monthStr);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance-overrides'] });
      toast.success('Override supprimé, calcul automatique rétabli');
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  // -------- Engine input & plan --------

  const plan = useMemo(() => {
    if (!months.length || !categories.length) return null;

    const storedForecasts = forecasts.map(f => ({
      categoryId: f.category_id,
      monthKey: f.month,
      expectedAmount: Number(f.expected_amount),
      amountBasis: f.amount_basis ?? 'ttc',
    }));

    const actualsFlat: ComputeCategoryTreasuryPlanInput['actuals'] = [];
    for (const [catId, byMonth] of Object.entries(actuals)) {
      for (const [m, v] of Object.entries(byMonth)) {
        actualsFlat.push({ categoryId: catId, monthKey: m, income: v.income, expense: v.expense });
      }
    }

    const uncategorizedFlat = Object.entries(uncategorized).map(([m, v]) => ({
      monthKey: m, income: v.income, expense: v.expense,
    }));

    const input: ComputeCategoryTreasuryPlanInput = {
      asOfDate: new Date(),
      months,
      categories: categories.map(c => ({
        id: c.id,
        type: c.type as 'income' | 'expense',
        vat_rate: c.vat_rate ?? 0,
        forecast_mode: (c.forecast_mode ?? null) as 'manual' | 'percent_of_revenue' | null,
        forecast_percent: c.forecast_percent ?? null,
        is_system: c.is_system ?? false,
      })),
      storedForecasts,
      actuals: actualsFlat,
      uncategorized: uncategorizedFlat,
      currentBalance: liveBankBalance ?? currentCompany?.initial_balance ?? 0,
      anchorTransactions: anchorWalkData?.transactions ?? [],
      balanceOverrides: balanceOverrides.map(o => ({ monthKey: o.month, balance: Number(o.balance) })),
      earliestTransactionDate: anchorWalkData?.earliestDate ?? null,
      initialBalance: currentCompany?.initial_balance ?? 0,
    };

    return computeCategoryTreasuryPlan(input);
  }, [
    months,
    categories,
    forecasts,
    actuals,
    uncategorized,
    liveBankBalance,
    currentCompany?.initial_balance,
    anchorWalkData,
    balanceOverrides,
  ]);

  // -------- Plan lookup helpers --------

  const getMonthPlan = useCallback((month: Date): CategoryMonthPlan | null => {
    if (!plan) return null;
    return plan.byMonth.get(toMonthKey(month)) ?? null;
  }, [plan]);

  // -------- Public API — pure reads on the plan --------

  const getForecast = useCallback((categoryId: string, month: Date): number => {
    return getMonthPlan(month)?.categories.get(categoryId)?.forecast ?? 0;
  }, [getMonthPlan]);

  const getActual = useCallback((categoryId: string, month: Date): number => {
    return getMonthPlan(month)?.categories.get(categoryId)?.actual ?? 0;
  }, [getMonthPlan]);

  const getMonthProjected = useCallback((type: 'income' | 'expense', month: Date): number => {
    const p = getMonthPlan(month);
    if (!p) return 0;
    // Note: engine section totals already include uncategorized on actual side;
    // for projection we need the CATEGORIZED+UNCAT bucket per type as in the old hook.
    return p[type].projected;
  }, [getMonthPlan]);

  const getVatForecast = useCallback((type: 'income' | 'expense', month: Date): number => {
    const p = getMonthPlan(month);
    if (!p) return 0;
    return type === 'income' ? p.vat.forecastIncome : p.vat.forecastExpense;
  }, [getMonthPlan]);

  const getVatActual = useCallback((type: 'income' | 'expense', month: Date): number => {
    const p = getMonthPlan(month);
    if (!p) return 0;
    return type === 'income' ? p.vat.actualIncome : p.vat.actualExpense;
  }, [getMonthPlan]);

  const getNetVatForecast = useCallback((month: Date): number => {
    return getMonthPlan(month)?.vat.netForecast ?? 0;
  }, [getMonthPlan]);

  const getNetVatActual = useCallback((month: Date): number => {
    return getMonthPlan(month)?.vat.netActual ?? 0;
  }, [getMonthPlan]);

  const getUncategorized = useCallback((type: 'income' | 'expense', month: Date): number => {
    const p = getMonthPlan(month);
    if (!p) return 0;
    return type === 'income' ? p.uncategorized.income : p.uncategorized.expense;
  }, [getMonthPlan]);

  const getOpeningBalance = useCallback((month: Date): {
    balance: number; isActual: boolean; isEstimated?: boolean; noData?: boolean;
  } => {
    const p = getMonthPlan(month);
    if (!p) return { balance: 0, isActual: true, noData: true };
    return { balance: p.opening.balance, isActual: p.opening.isActual, noData: p.opening.noData };
  }, [getMonthPlan]);

  const getClosingBalance = useCallback((month: Date): {
    balance: number;
    forecastBalance?: number;
    projectedBalance?: number;
    isActual: boolean;
    isEstimated?: boolean;
    noData?: boolean;
  } => {
    const p = getMonthPlan(month);
    if (!p) return { balance: 0, isActual: true, noData: true };
    return {
      balance: p.closing.balance,
      forecastBalance: p.closing.forecastBalance,
      projectedBalance: p.closing.projectedBalance,
      isActual: p.closing.isActual,
      noData: p.closing.noData,
    };
  }, [getMonthPlan]);

  const getReconciliationGap = useCallback((month: Date): ReconciliationGap | null => {
    return getMonthPlan(month)?.reconciliationGap ?? null;
  }, [getMonthPlan]);

  const reconciliationGaps = useMemo<Map<string, ReconciliationGap>>(() => {
    const out = new Map<string, ReconciliationGap>();
    if (!plan) return out;
    for (const p of plan.months) {
      if (p.reconciliationGap) out.set(format(startOfMonth(p.month), 'yyyy-MM'), p.reconciliationGap);
    }
    return out;
  }, [plan]);

  // -------- Metadata helpers (stored forecast lookups) --------

  const getStoredForecast = useCallback((categoryId: string, month: Date) => {
    const monthStr = format(month, 'yyyy-MM-01');
    return forecasts.find(f => f.category_id === categoryId && f.month === monthStr);
  }, [forecasts]);

  const getForecastSource = useCallback(
    (categoryId: string, month: Date): 'manual' | 'bp_import' | 'bp_synced' | null => {
      return getStoredForecast(categoryId, month)?.source ?? null;
    },
    [getStoredForecast],
  );

  const isManualOverride = useCallback((categoryId: string, month: Date): boolean => {
    const category = categories.find(c => c.id === categoryId);
    if (category?.forecast_mode !== 'percent_of_revenue') return false;
    return !!getStoredForecast(categoryId, month);
  }, [categories, getStoredForecast]);

  // Income forecast total in HT — base for variable charge calculation.
  // Mirrors the engine's percent_of_revenue rule (stored HT converted, else 0).
  const getIncomeForecastTotal = useCallback((month: Date): number => {
    return categories
      .filter(c => c.type === 'income')
      .reduce((sum, c) => {
        const stored = getStoredForecast(c.id, month);
        if (!stored) return sum;
        return sum + toHt(stored.expected_amount, stored.amount_basis, c.vat_rate);
      }, 0);
  }, [categories, getStoredForecast]);

  const getIncomeForecastTotalTtc = useCallback((month: Date): number => {
    const p = getMonthPlan(month);
    if (!p) return 0;
    // Categorized income forecast, matching the "TTC displayed" income total.
    return p.income.forecast;
  }, [getMonthPlan]);

  // -------- Balance overrides (stored lookup) --------

  const getBalanceOverride = useCallback((month: Date): number | null => {
    const monthStr = format(month, 'yyyy-MM-01');
    const override = balanceOverrides.find(o => o.month === monthStr);
    return override ? Number(override.balance) : null;
  }, [balanceOverrides]);

  // -------- Payables helpers (kept identical to the previous implementation) --------

  const getPayableOutflow = useCallback((month: Date): number => {
    const todayStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(todayStart);
    const targetStart = startOfMonth(month);
    const targetEnd = endOfMonth(month);

    return payableInvoices
      .filter(inv => {
        const dueDate = new Date(inv.due_date);
        if (isBefore(dueDate, todayStart)) {
          return !isBefore(targetEnd, todayStart) && !isBefore(currentMonthEnd, targetStart);
        }
        return dueDate >= targetStart && dueDate <= targetEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
  }, [payableInvoices]);

  const getPayableOutflowByCategory = useCallback((categoryId: string, month: Date): number => {
    const todayStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(todayStart);
    const targetStart = startOfMonth(month);
    const targetEnd = endOfMonth(month);

    return payableInvoices
      .filter(inv => {
        if (inv.category_id !== categoryId) return false;
        const dueDate = new Date(inv.due_date);
        if (isBefore(dueDate, todayStart)) {
          return !isBefore(targetEnd, todayStart) && !isBefore(currentMonthEnd, targetStart);
        }
        return dueDate >= targetStart && dueDate <= targetEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
  }, [payableInvoices]);

  const getPayableOutflowUncategorized = useCallback((month: Date): number => {
    const todayStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(todayStart);
    const targetStart = startOfMonth(month);
    const targetEnd = endOfMonth(month);

    return payableInvoices
      .filter(inv => {
        if (inv.category_id !== null) return false;
        const dueDate = new Date(inv.due_date);
        if (isBefore(dueDate, todayStart)) {
          return !isBefore(targetEnd, todayStart) && !isBefore(currentMonthEnd, targetStart);
        }
        return dueDate >= targetStart && dueDate <= targetEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
  }, [payableInvoices]);

  return {
    months,
    forecasts,
    actuals,
    uncategorized,
    categories,
    isLoading: forecastsLoading || actualsLoading || uncategorizedLoading || payablesLoading,
    upsertForecast,
    getForecast,
    getForecastSource,
    isManualOverride,
    clearForecastOverride,
    getActual,
    getVatForecast,
    getVatActual,
    getNetVatForecast,
    getNetVatActual,
    getUncategorized,
    getIncomeForecastTotal,
    getIncomeForecastTotalTtc,
    getMonthProjected,
    getClosingBalance,
    upsertBalanceOverride,
    deleteBalanceOverride,
    getBalanceOverride,
    payableInvoices,
    getPayableOutflow,
    getPayableOutflowByCategory,
    getPayableOutflowUncategorized,
    payablesLoading,
    getOpeningBalance,
    getReconciliationGap,
    reconciliationGaps,

    extendBefore,
    extendAfter,
    shrinkBefore,
    shrinkAfter,
    resetPeriod,
    monthsBefore,
    monthsAfter,
  };
}
