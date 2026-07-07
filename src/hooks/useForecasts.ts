import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { useCategories, Category } from './useCategories';
import { toast } from 'sonner';
import { addMonths, startOfMonth, endOfMonth, format, isBefore, isSameMonth } from 'date-fns';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getDisplayedSectionTotals, getDisplayedNetVariation } from '@/lib/forecastDisplayTotals';
import { calculatePercentOfRevenueForecast, getVatFromAmount, toHt, toTtc } from '@/lib/forecastAmounts';
import { computeCurrentMonthProjection } from '@/features/treasury/engine/currentMonthProjection';
import { computeBalanceAnchors } from '@/features/treasury/engine/computeBalanceAnchors';

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

  // Dynamic period state - persisted in localStorage with stable reference
  const todayRef = useRef(startOfMonth(new Date()));
  const today = todayRef.current;
  
  // Load initial values from localStorage with stable keys
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

  // Sync with localStorage when values change
  useEffect(() => {
    localStorage.setItem(MONTHS_BEFORE_KEY, String(monthsBefore));
  }, [monthsBefore]);

  useEffect(() => {
    localStorage.setItem(MONTHS_AFTER_KEY, String(monthsAfter));
  }, [monthsAfter]);

  // Compute months array based on period - use stable today reference
  const months = useMemo(() => {
    const result: Date[] = [];
    const startMonth = addMonths(today, -monthsBefore);
    const totalMonths = monthsBefore + 1 + monthsAfter;
    for (let i = 0; i < totalMonths; i++) {
      result.push(addMonths(startMonth, i));
    }
    return result;
  }, [today, monthsBefore, monthsAfter]);

  // Period control functions
  const extendBefore = useCallback(() => {
    setMonthsBeforeState(prev => prev + 1);
  }, []);

  const extendAfter = useCallback(() => {
    setMonthsAfterState(prev => prev + 1);
  }, []);

  const shrinkBefore = useCallback(() => {
    setMonthsBeforeState(prev => Math.max(0, prev - 1));
  }, []);

  const shrinkAfter = useCallback(() => {
    setMonthsAfterState(prev => Math.max(0, prev - 1));
  }, []);

  const resetPeriod = useCallback(() => {
    setMonthsBeforeState(0);
    setMonthsAfterState(5);
  }, []);

  // Compute query date range
  const startMonthStr = months.length > 0 ? format(months[0], 'yyyy-MM-01') : '';
  const endMonthStr = months.length > 0 ? format(months[months.length - 1], 'yyyy-MM-01') : '';

  // Fetch category forecasts
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

  // Fetch actual amounts from transactions grouped by category, month AND type
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
      
      // Group by category, month, AND transaction type
      const grouped: Record<string, Record<string, { income: number; expense: number }>> = {};
      
      data?.forEach((tx) => {
        if (!tx.category_id) return;
        
        const monthKey = format(new Date(tx.date), 'yyyy-MM-01');
        if (!grouped[tx.category_id]) {
          grouped[tx.category_id] = {};
        }
        if (!grouped[tx.category_id][monthKey]) {
          grouped[tx.category_id][monthKey] = { income: 0, expense: 0 };
        }
        const amount = Number(tx.amount);
        if (tx.type === 'income') {
          grouped[tx.category_id][monthKey].income += amount;
        } else {
          grouped[tx.category_id][monthKey].expense += amount;
        }
      });
      
      return grouped;
    },
    enabled: !!user?.id && !!startMonthStr,
  });

  // Fetch uncategorized transactions grouped by month
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
      
      // Group by month and type
      const grouped: Record<string, { income: number; expense: number }> = {};
      
      data?.forEach((tx) => {
        const monthKey = format(new Date(tx.date), 'yyyy-MM-01');
        if (!grouped[monthKey]) {
          grouped[monthKey] = { income: 0, expense: 0 };
        }
        const amount = Math.abs(Number(tx.amount));
        if (tx.type === 'income') {
          grouped[monthKey].income += amount;
        } else {
          grouped[monthKey].expense += amount;
        }
      });
      
      return grouped;
    },
    enabled: !!user?.id && !!startMonthStr,
  });

  // Upsert forecast
  const upsertForecast = useMutation({
    mutationFn: async ({ 
      categoryId, 
      month, 
      expectedAmount 
    }: { 
      categoryId: string; 
      month: Date; 
      expectedAmount: number;
    }) => {
      if (!user?.id || !currentCompany) throw new Error('Non authentifié ou pas de société');
      
      // Use owner's user_id for data consistency across members
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
          amount_basis: 'ttc', // TTC convention — see features/treasury/cash-flow-standard
        } as never, {
          onConflict: 'user_id,category_id,month',
        })
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

  // Helper to check if a percent_of_revenue category has a manual override for a given month
  const isManualOverride = useCallback((categoryId: string, month: Date): boolean => {
    const category = categories.find(c => c.id === categoryId);
    if (category?.forecast_mode !== 'percent_of_revenue') return false;
    const monthStr = format(month, 'yyyy-MM-01');
    return forecasts.some(f => f.category_id === categoryId && f.month === monthStr);
  }, [forecasts, categories]);

  // Helper to clear a manual override (delete the forecast entry) to revert to auto calculation
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

  // Helper to get forecast for a specific category and month
  const getStoredForecast = useCallback((categoryId: string, month: Date) => {
    const monthStr = format(month, 'yyyy-MM-01');
    return forecasts.find(
      f => f.category_id === categoryId && f.month === monthStr,
    );
  }, [forecasts]);

  const getForecast = useCallback((categoryId: string, month: Date): number => {
    const category = categories.find(c => c.id === categoryId);
    
    // For percent_of_revenue categories: check manual override first, then auto-calculate
    if (category?.forecast_mode === 'percent_of_revenue' && (category.forecast_percent ?? 0) > 0) {
      // Check for manual override
      const manualForecast = getStoredForecast(categoryId, month);
      if (manualForecast) {
        return toTtc(manualForecast.expected_amount, manualForecast.amount_basis, category.vat_rate);
      }
      
      // Auto-calculate from income HT, then convert the result to TTC for display/storage convention
      const incomeHtTotal = categories
        .filter(c => c.type === 'income')
        .reduce((sum, c) => {
          const storedForecast = getStoredForecast(c.id, month);
          if (!storedForecast) return sum;
          return sum + toHt(storedForecast.expected_amount, storedForecast.amount_basis, c.vat_rate);
        }, 0);

      return calculatePercentOfRevenueForecast({
        percentage: category.forecast_percent,
        revenueHt: incomeHtTotal,
        vatRate: category.vat_rate,
        outputBasis: 'ttc',
      });
    }
    
    const forecast = getStoredForecast(categoryId, month);
    return forecast
      ? toTtc(forecast.expected_amount, forecast.amount_basis, category?.vat_rate)
      : 0;
  }, [categories, getStoredForecast]);

  // Helper to get forecast source for a specific category and month
  const getForecastSource = (categoryId: string, month: Date): 'manual' | 'bp_import' | 'bp_synced' | null => {
    const forecast = getStoredForecast(categoryId, month);
    return forecast?.source || null;
  };

  // Helper to get actual amount for a specific category and month
  // Returns only the amount matching the category's type to prevent mixing income/expense
  const getActual = (categoryId: string, month: Date): number => {
    const monthStr = format(month, 'yyyy-MM-01');
    const data = actuals[categoryId]?.[monthStr];
    if (!data) return 0;
    
    // Find the category to determine which type of transactions to return
    const category = categories.find(c => c.id === categoryId);
    if (!category) return data.income + data.expense; // fallback
    
    // Return only the amount matching the category type
    return category.type === 'income' ? data.income : data.expense;
  };

  // Helper to calculate VAT forecast for a type (income/expense) and month
  const getVatForecast = (type: 'income' | 'expense', month: Date): number => {
    const typedCategories = categories.filter(c => c.type === type && !c.is_system);
    return typedCategories.reduce((sum, cat) => {
      const storedForecast = getStoredForecast(cat.id, month);
      const vatAmount = storedForecast
        ? getVatFromAmount(storedForecast.expected_amount, storedForecast.amount_basis, cat.vat_rate)
        : getVatFromAmount(getForecast(cat.id, month), 'ttc', cat.vat_rate);
      return sum + vatAmount;
    }, 0);
  };

  // Helper to calculate VAT actual for a type (income/expense) and month
  // NOTE: Bank transactions are already TTC, so this is an *estimate* of the VAT component
  // It should NOT be added to actuals for total calculations
  const getVatActual = (type: 'income' | 'expense', month: Date): number => {
    const typedCategories = categories.filter(c => c.type === type && !c.is_system);
    return typedCategories.reduce((sum, cat) => {
      const actual = Math.abs(getActual(cat.id, month));
      // Reverse-calculate VAT from TTC amount: vatAmount = ttc * rate / (1 + rate)
      const vatAmount = cat.vat_rate > 0 ? actual * cat.vat_rate / (1 + cat.vat_rate) : 0;
      return sum + vatAmount;
    }, 0);
  };

  // Helper to get net VAT to pay (collected - deductible) for a given month
  // Positive = VAT to pay to the state, Negative = VAT credit
  const getNetVatForecast = useCallback((month: Date): number => {
    return getVatForecast('income', month) - getVatForecast('expense', month);
  }, [categories, getForecast]);

  const getNetVatActual = useCallback((month: Date): number => {
    return getVatActual('income', month) - getVatActual('expense', month);
  }, [categories]);

  const getUncategorized = (type: 'income' | 'expense', month: Date): number => {
    const monthStr = format(month, 'yyyy-MM-01');
    return uncategorized[monthStr]?.[type] ?? 0;
  };

  // Fetch payable invoices (supplier debts)
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

  // allTransactions query REMOVED — replaced by snapshot-based forward-only approach

  // === Backward-walk anchor data ===
  // Purpose: derive `opening(M) = currentBalance − Σ tx ∈ [1er de M, aujourd'hui]`
  // for every past & current month, without ever using the live balance as
  // the opening of the current month. See computeBalanceAnchors.ts.
  //
  // We fetch SIGNED bank movements (income+, expense−) bounded by the widest
  // displayed window. `is_ignored` IS included on purpose: an ignored tx still
  // moved money at the bank, so it must count in the walk. `deleted_at` is
  // excluded. Restricted to active bank accounts via `company_active_bridge_accounts`
  // to match the same perimeter as `liveBankBalance`.
  const { data: anchorWalkData } = useQuery({
    queryKey: ['balance-anchor-walk', currentCompany?.id, startMonthStr],
    queryFn: async () => {
      if (!currentCompany?.id || !startMonthStr) {
        return { transactions: [] as Array<{ date: string; amount: number }>, earliestDate: null as string | null };
      }
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Active account ids (same perimeter as liveBankBalance).
      const { data: activeAccounts, error: accErr } = await supabase
        .from('company_active_bridge_accounts')
        .select('bridge_account_id')
        .eq('company_id', currentCompany.id);
      if (accErr) throw accErr;
      const activeIds = (activeAccounts ?? [])
        .map(a => (a as { bridge_account_id: number | null }).bridge_account_id)
        .filter((v): v is number => v != null);

      // Paginated fetch of SIGNED tx in [startMonthStr, today]. Includes is_ignored.
      const pageSize = 1000;
      const rows: Array<{ date: string; amount: number; type: string; bridge_account_id: number | null }> = [];
      let from = 0;
      // Cap safety: 20 pages = 20k rows / window. Widen only if the horizon grows.
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
        if (activeIds.length > 0) {
          q = q.in('bridge_account_id', activeIds);
        }
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

      // Earliest known transaction (any date) — bounds the noData region.
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

  // Fetch manual balance overrides
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

  // Upsert balance override
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

  // Delete balance override
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

  // Helper to get balance override for a month
  const getBalanceOverride = useCallback((month: Date): number | null => {
    const monthStr = format(month, 'yyyy-MM-01');
    const override = balanceOverrides.find(o => o.month === monthStr);
    return override ? Number(override.balance) : null;
  }, [balanceOverrides]);

  // getSnapshotForEndOfMonth REMOVED — Point Zéro forward-only approach

  // Helper to get payable outflow for a specific month
  // Rule: overdue invoices (due_date < today) -> placed at end of current month
  //       pending invoices -> placed at their due_date month
  const getPayableOutflow = useCallback((month: Date): number => {
    const todayStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(todayStart);
    const targetStart = startOfMonth(month);
    const targetEnd = endOfMonth(month);
    
    return payableInvoices
      .filter(inv => {
        const dueDate = new Date(inv.due_date);
        
        // Overdue invoice -> place at end of current month
        if (isBefore(dueDate, todayStart)) {
          // Target is the current month
          return !isBefore(targetEnd, todayStart) && !isBefore(currentMonthEnd, targetStart);
        }
        
        // Normal invoice -> place at its due_date month
        return dueDate >= targetStart && dueDate <= targetEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
  }, [payableInvoices]);

  // Helper to get payable outflow for a specific category and month
  const getPayableOutflowByCategory = useCallback((categoryId: string, month: Date): number => {
    const todayStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(todayStart);
    const targetStart = startOfMonth(month);
    const targetEnd = endOfMonth(month);
    
    return payableInvoices
      .filter(inv => {
        // Must match category
        if (inv.category_id !== categoryId) return false;
        
        const dueDate = new Date(inv.due_date);
        
        // Overdue invoice -> place at end of current month
        if (isBefore(dueDate, todayStart)) {
          return !isBefore(targetEnd, todayStart) && !isBefore(currentMonthEnd, targetStart);
        }
        
        // Normal invoice -> place at its due_date month
        return dueDate >= targetStart && dueDate <= targetEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
  }, [payableInvoices]);

  // Helper to get payable outflow for uncategorized invoices
  const getPayableOutflowUncategorized = useCallback((month: Date): number => {
    const todayStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(todayStart);
    const targetStart = startOfMonth(month);
    const targetEnd = endOfMonth(month);
    
    return payableInvoices
      .filter(inv => {
        // Must be uncategorized
        if (inv.category_id !== null) return false;
        
        const dueDate = new Date(inv.due_date);
        
        // Overdue invoice -> place at end of current month
        if (isBefore(dueDate, todayStart)) {
          return !isBefore(targetEnd, todayStart) && !isBefore(currentMonthEnd, targetStart);
        }
        
        // Normal invoice -> place at its due_date month
        return dueDate >= targetStart && dueDate <= targetEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
  }, [payableInvoices]);

  // === Displayed totals helpers (single source of truth for table, chart, balance engine) ===
  // These use forecastDisplayTotals.ts to guarantee the invariant:
  //   opening(m) + displayedNet(m) = closing(m) = opening(m+1)

  const getMonthTotalForType = useCallback((type: 'income' | 'expense', month: Date, valueType: 'forecast' | 'actual'): number => {
    const cats = categories.filter(c => c.type === type && !c.is_system);
    return cats.reduce((sum, cat) => {
      if (valueType === 'forecast') {
        return sum + getForecast(cat.id, month);
      }
      return sum + Math.abs(getActual(cat.id, month));
    }, 0);
  }, [categories, getForecast, getActual]);

  const getDisplayedSectionTotalsForMonth = useCallback((type: 'income' | 'expense', month: Date) => {
    return getDisplayedSectionTotals({
      type,
      categorizedActual: getMonthTotalForType(type, month, 'actual'),
      uncategorizedActual: getUncategorized(type, month),
      categorizedForecast: getMonthTotalForType(type, month, 'forecast'),
      netVatForecast: getNetVatForecast(month),
    });
  }, [getMonthTotalForType, getNetVatForecast, getUncategorized]);

  const getDisplayedNetTotalsForMonth = useCallback((month: Date) => {
    const incomeTotals = getDisplayedSectionTotalsForMonth('income', month);
    const expenseTotals = getDisplayedSectionTotalsForMonth('expense', month);
    return getDisplayedNetVariation(incomeTotals, expenseTotals);
  }, [getDisplayedSectionTotalsForMonth]);

  // Projected total for the CURRENT month, applied per `type`. Past months
  // return the actual total; future months return the forecast total. The
  // current-month projection rule is delegated to the shared engine helper
  // (`computeCurrentMonthProjection`) so the moteur de trésorerie and ce hook
  // restent strictement alignés.
  const getMonthProjected = useCallback((type: 'income' | 'expense', month: Date): number => {
    const monthStart = startOfMonth(month);
    const todayStart = startOfMonth(new Date());
    if (isBefore(monthStart, todayStart)) {
      // Past closed month → actuals (categorized + uncategorized).
      return getMonthTotalForType(type, month, 'actual') + getUncategorized(type, month);
    }
    if (isSameMonth(monthStart, todayStart)) {
      // Current month → shared rule, per type.
      const actualAbs =
        getMonthTotalForType(type, month, 'actual') + getUncategorized(type, month);
      const forecastAbs = getMonthTotalForType(type, month, 'forecast');
      // Synthetic bucket carrying the right sign convention for the helper.
      const syntheticBucket = type === 'income' ? 'revenue' : 'fixed_expenses';
      const sign = type === 'income' ? 1 : -1;
      const { projectedByBucket } = computeCurrentMonthProjection({
        actualByBucket: { [syntheticBucket]: sign * actualAbs },
        forecastByBucket: { [syntheticBucket]: sign * forecastAbs },
      });
      return Math.abs(projectedByBucket[syntheticBucket] ?? 0);
    }
    // Future month → forecast envelope.
    return getMonthTotalForType(type, month, 'forecast');
  }, [getMonthTotalForType, getUncategorized]);

  // Net forecast delta used by the balance engine. For past months it
  // mirrors actuals; for the current month it uses the projected view so
  // that the forward walk (next-month opening) starts from the projected
  // closing, not from the raw actual closing.
  const getMonthNetForecast = useCallback((month: Date): number => {
    return getMonthProjected('income', month) - getMonthProjected('expense', month);
  }, [getMonthProjected]);

  // Fetch live bank balance via la vue centrale company_active_bridge_accounts
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

  // Backward-walk anchors for all past & current months displayed.
  // Uses the SAME perimeter as `liveBankBalance` (active bridge accounts) and
  // includes `is_ignored` transactions (they moved the bank balance).
  const anchorMap = useMemo(() => {
    if (!months.length) return new Map<string, ReturnType<typeof computeBalanceAnchors> extends Map<string, infer V> ? V : never>();
    const currentBalance =
      liveBankBalance ?? currentCompany?.initial_balance ?? 0;
    return computeBalanceAnchors({
      currentBalance,
      transactions: anchorWalkData?.transactions ?? [],
      asOfDate: new Date(),
      months,
      overrides: balanceOverrides.map(o => ({ month: o.month, balance: Number(o.balance) })),
      earliestTransactionDate: anchorWalkData?.earliestDate ?? null,
    });
  }, [months, liveBankBalance, currentCompany?.initial_balance, anchorWalkData, balanceOverrides]);

  // Opening balance — backward walk from live balance for past & current
  // month; forward walk from the current-month anchor (never the live balance
  // directly) for future months.
  const getOpeningBalance = useCallback((month: Date): { balance: number; isActual: boolean; isEstimated?: boolean; noData?: boolean } => {
    const todayMonth = startOfMonth(new Date());
    const targetMonth = startOfMonth(month);
    const targetKey = format(targetMonth, 'yyyy-MM');

    // Past & current month: consult the backward-walk map (which already
    // resolves override priority and noData boundary).
    if (!isBefore(todayMonth, targetMonth)) {
      // targetMonth ≤ todayMonth
      const anchor = anchorMap.get(targetKey);
      if (anchor) {
        return {
          balance: anchor.balance,
          isActual: anchor.isActual,
          noData: anchor.noData || undefined,
        };
      }
      return { balance: 0, isActual: true, noData: true };
    }

    // Future month: anchor at current-month opening + forward net walk.
    // Override on prev month still wins.
    const prevOverride = getBalanceOverride(addMonths(targetMonth, -1));
    if (prevOverride !== null) {
      return { balance: prevOverride, isActual: true };
    }

    const currentKey = format(todayMonth, 'yyyy-MM');
    const currentAnchor = anchorMap.get(currentKey);
    const openingCurrent = currentAnchor?.balance
      ?? (liveBankBalance ?? currentCompany?.initial_balance ?? 0);

    // Start from current-month CLOSING (opening + projected net), then walk.
    let balance = openingCurrent + getMonthNetForecast(todayMonth);
    for (let m = addMonths(todayMonth, 1); isBefore(m, targetMonth); m = addMonths(m, 1)) {
      balance += getMonthNetForecast(m);
    }
    return { balance, isActual: false };
  }, [anchorMap, liveBankBalance, currentCompany?.initial_balance, getMonthNetForecast, getBalanceOverride]);

  // Helper to get total income forecast (HT) for a month - used as the base for variable charge calculation.
  // Calculation MUST stay on HT — see mem://features/treasury/cash-flow-standard.
  const getIncomeForecastTotal = useCallback((month: Date): number => {
    return categories
      .filter(c => c.type === 'income')
      .reduce((sum, c) => {
        const forecast = getStoredForecast(c.id, month);
        if (!forecast) return sum;
        return sum + toHt(forecast.expected_amount, forecast.amount_basis, c.vat_rate);
      }, 0);
  }, [categories, getStoredForecast]);

  // Helper to get total income forecast (TTC) for a month — used purely for display in tooltips
  // so that values shown stay consistent with the rest of the forecast grid (which is TTC).
  const getIncomeForecastTotalTtc = useCallback((month: Date): number => {
    return categories
      .filter(c => c.type === 'income')
      .reduce((sum, c) => {
        const forecast = getStoredForecast(c.id, month);
        if (!forecast) return sum;
        return sum + toTtc(forecast.expected_amount, forecast.amount_basis, c.vat_rate);
      }, 0);
  }, [categories, getStoredForecast]);


  // Helper to calculate month net actual (real bank transactions) for a given month
  // Uses the same sources as the "Variation nette du mois" row in the forecast table
  const getMonthNetActual = useCallback((month: Date): number => {
    const incomeCategories = categories.filter(c => c.type === 'income');
    const expenseCategories = categories.filter(c => c.type === 'expense');

    // Categorized actuals
    const incomeActual = incomeCategories.reduce((sum, cat) => sum + Math.abs(getActual(cat.id, month)), 0);
    const expenseActual = expenseCategories.reduce((sum, cat) => sum + Math.abs(getActual(cat.id, month)), 0);

    // Uncategorized actuals
    const uncatIncome = getUncategorized('income', month);
    const uncatExpense = getUncategorized('expense', month);

    return (incomeActual + uncatIncome) - (expenseActual + uncatExpense);
  }, [categories, getActual, getUncategorized]);

  // Closing balance.
  // For past/future months: equals next month's opening (which walks the
  // forward ledger using `getMonthNetForecast` — itself projected for the
  // current month). For the CURRENT month we expose three views:
  //   - balance           : opening + actual net to date (informational)
  //   - forecastBalance   : opening + raw forecast envelope net (legacy field, kept for retro-compat)
  //   - projectedBalance  : opening + projected net (the value to display)
  // This is the SAME projection rule as the engine, applied via the shared
  // helper inside getMonthNetForecast.
  const getClosingBalance = useCallback((month: Date): {
    balance: number;
    forecastBalance?: number;
    projectedBalance?: number;
    isActual: boolean;
    isEstimated?: boolean;
    noData?: boolean;
  } => {
    const opening = getOpeningBalance(month);

    if (opening.noData) {
      return { balance: 0, isActual: true, noData: true };
    }

    const override = getBalanceOverride(month);
    if (override !== null) {
      return { balance: override, isActual: true };
    }

    const nextMonth = addMonths(startOfMonth(month), 1);
    const nextOpening = getOpeningBalance(nextMonth);

    if (isSameMonth(month, new Date())) {
      const netActual = getMonthNetActual(month);
      const netProjected = getMonthNetForecast(month); // projected net (helper-based)
      // Raw forecast envelope net (kept for legacy `forecastBalance` field)
      const rawForecastNet =
        getMonthTotalForType('income', month, 'forecast') -
        getMonthTotalForType('expense', month, 'forecast');
      return {
        balance: opening.balance + netActual,
        forecastBalance: opening.balance + rawForecastNet,
        projectedBalance: opening.balance + netProjected,
        isActual: false,
      };
    }

    return { balance: nextOpening.balance, isActual: nextOpening.isActual, noData: nextOpening.noData };
  }, [getOpeningBalance, getMonthNetForecast, getMonthNetActual, getMonthTotalForType, getBalanceOverride]);

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
    // Projection per type (past=actual, current=projected via shared helper, future=forecast)
    getMonthProjected,
    // Closing balance
    getClosingBalance,
    // Balance overrides
    upsertBalanceOverride,
    deleteBalanceOverride,
    getBalanceOverride,
    // Payables
    payableInvoices,
    getPayableOutflow,
    getPayableOutflowByCategory,
    getPayableOutflowUncategorized,
    payablesLoading,
    // Opening balance
    getOpeningBalance,
    // Period controls
    extendBefore,
    extendAfter,
    shrinkBefore,
    shrinkAfter,
    resetPeriod,
    monthsBefore,
    monthsAfter,
  };
}
