import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { useCategories, Category } from './useCategories';
import { toast } from 'sonner';
import { addMonths, startOfMonth, endOfMonth, format, differenceInMonths, isBefore, isSameMonth } from 'date-fns';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

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
        }, {
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
  const getForecast = useCallback((categoryId: string, month: Date): number => {
    const category = categories.find(c => c.id === categoryId);
    
    // For percent_of_revenue categories: check manual override first, then auto-calculate
    if (category?.forecast_mode === 'percent_of_revenue' && (category.forecast_percent ?? 0) > 0) {
      const monthStr = format(month, 'yyyy-MM-01');
      
      // Check for manual override
      const manualForecast = forecasts.find(f => f.category_id === categoryId && f.month === monthStr);
      if (manualForecast) {
        return manualForecast.expected_amount;
      }
      
      // Auto-calculate from income
      const incomeTotal = categories
        .filter(c => c.type === 'income')
        .reduce((sum, c) => {
          const f = forecasts.find(fc => fc.category_id === c.id && fc.month === monthStr);
          return sum + (f?.expected_amount ?? 0);
        }, 0);
      return (category.forecast_percent! / 100) * incomeTotal;
    }
    
    const monthStr = format(month, 'yyyy-MM-01');
    const forecast = forecasts.find(
      f => f.category_id === categoryId && f.month === monthStr
    );
    return forecast?.expected_amount ?? 0;
  }, [forecasts, categories]);

  // Helper to get forecast source for a specific category and month
  const getForecastSource = (categoryId: string, month: Date): 'manual' | 'bp_import' | 'bp_synced' | null => {
    const monthStr = format(month, 'yyyy-MM-01');
    const forecast = forecasts.find(
      f => f.category_id === categoryId && f.month === monthStr
    );
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
      const forecast = getForecast(cat.id, month);
      const vatAmount = forecast * cat.vat_rate;
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

  // Fetch all transactions for opening balance calculation (need ALL transactions for proper balance)
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['all-transactions-for-balance', user?.id, currentCompany?.id],
    queryFn: async () => {
      if (!user?.id || !currentCompany?.id) return [];
      
      // Fetch in batches to avoid the 1000 row default limit
      const batchSize = 1000;
      let allData: { amount: number; date: string; type: string }[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('transactions')
          .select('amount, date, type')
          .eq('company_id', currentCompany.id)
          .is('deleted_at', null)
          .or('is_ignored.is.null,is_ignored.eq.false')
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        hasMore = (data?.length ?? 0) === batchSize;
        offset += batchSize;
      }
      
      return allData;
    },
    enabled: !!user?.id && !!currentCompany?.id,
  });

  // Fetch balance snapshots for past months (use real recorded balances instead of retroactive calc)
  const { data: balanceSnapshots = [] } = useQuery({
    queryKey: ['balance-snapshots', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('bank_balance_snapshots')
        .select('bridge_account_id, balance, snapshot_date')
        .eq('company_id', currentCompany.id)
        .order('snapshot_date', { ascending: false });
      if (error) throw error;
      return (data || []) as { bridge_account_id: number; balance: number; snapshot_date: string }[];
    },
    enabled: !!currentCompany?.id,
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

  // Helper: get total snapshot balance for the last day of a given month
  const getSnapshotForEndOfMonth = useCallback((month: Date): number | null => {
    const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
    
    // Find all snapshots within this month, take the latest one (already sorted desc)
    const monthSnapshots = balanceSnapshots.filter(
      s => s.snapshot_date >= monthStart && s.snapshot_date <= monthEnd
    );
    
    if (monthSnapshots.length === 0) return null;
    
    // Group by the latest date and sum all accounts for that date
    const latestDate = monthSnapshots[0].snapshot_date;
    const latestSnapshots = monthSnapshots.filter(s => s.snapshot_date === latestDate);
    return latestSnapshots.reduce((sum, s) => sum + Number(s.balance), 0);
  }, [balanceSnapshots]);

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

  // Helper to calculate month net forecast (for projected balance calculation)
  const getMonthNetForecast = useCallback((month: Date): number => {
    // Income TTC - Expense TTC - TVA nette à décaisser
    let incomeTtc = 0;
    let expenseTtc = 0;
    
    categories.filter(c => !c.is_system).forEach(cat => {
      const forecast = getForecast(cat.id, month);
      const vatAmount = forecast * cat.vat_rate;
      const ttc = forecast + vatAmount;
      
      if (cat.type === 'income') {
        incomeTtc += ttc;
      } else {
        // Use max(forecast, payables) to avoid double-counting
        const payable = getPayableOutflowByCategory(cat.id, month);
        expenseTtc += Math.max(ttc, payable);
      }
    });
    
    // Add uncategorized payables
    expenseTtc += getPayableOutflowUncategorized(month);
    
    // Add net VAT to pay (only if positive = amount to pay to state)
    const netVat = getNetVatForecast(month);
    if (netVat > 0) {
      expenseTtc += netVat;
    }
    
    return incomeTtc - expenseTtc;
  }, [categories, getForecast, getPayableOutflowByCategory, getPayableOutflowUncategorized, getNetVatForecast]);

  // Fetch live bank balance from bridge_accounts (assigned to this company)
  const { data: liveBankBalance } = useQuery({
    queryKey: ['live-bank-balance', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      const { data: assignments, error: assignError } = await supabase
        .from('company_bridge_accounts')
        .select('bridge_account_id')
        .eq('company_id', currentCompany.id);
      
      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) return null;
      
      const assignedIds = assignments.map(a => a.bridge_account_id);
      
      const { data: accounts, error: accountsError } = await supabase
        .from('bridge_accounts')
        .select('balance')
        .in('bridge_account_id', assignedIds);
      
      if (accountsError) throw accountsError;
      
      return accounts?.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) ?? null;
    },
    enabled: !!currentCompany?.id,
    staleTime: 30 * 1000,
  });

  // Calculate the opening balance for a given month
  // Anchored on the current Bridge bank balance (most reliable reference point)
  // Past months: walk backwards by subtracting transactions between target and now
  // Future months: walk forwards by adding net forecasts
  const getOpeningBalance = useCallback((month: Date): { balance: number; isActual: boolean; isEstimated?: boolean } => {
    // Use live bank balance from bridge_accounts, fallback to companies.bank_balance
    const currentBankBalance = liveBankBalance ?? (currentCompany?.bank_balance != null ? Number(currentCompany.bank_balance) : null);
    const hasBankBalance = currentBankBalance != null;
    const initialBalance = currentCompany?.initial_balance ?? 0;
    const todayMonth = startOfMonth(new Date());
    const targetMonth = startOfMonth(month);
    
    // If no Bridge connection, fall back to initial_balance + cumulative transactions
    if (!hasBankBalance) {
      if (isBefore(targetMonth, addMonths(todayMonth, 1))) {
        const transactionsBeforeTarget = allTransactions.filter(tx => {
          const txDate = new Date(tx.date);
          return txDate < targetMonth;
        });
        const netBefore = transactionsBeforeTarget.reduce((sum, tx) => {
          const amount = Number(tx.amount);
          return sum + (tx.type === 'income' ? amount : -amount);
        }, 0);
        return { balance: initialBalance + netBefore, isActual: !isBefore(todayMonth, targetMonth) };
      }
      const allPastNet = allTransactions.reduce((sum, tx) => {
        const amount = Number(tx.amount);
        return sum + (tx.type === 'income' ? amount : -amount);
      }, 0);
      let projected = initialBalance + allPastNet;
      for (let m = addMonths(todayMonth, 1); isBefore(m, targetMonth); m = addMonths(m, 1)) {
        projected += getMonthNetForecast(m);
      }
      return { balance: projected, isActual: false };
    }
    
    if (isSameMonth(month, new Date())) {
      // Check if previous month has a balance override
      const prevMonth = addMonths(targetMonth, -1);
      const prevOverride = getBalanceOverride(prevMonth);
      if (prevOverride !== null) {
        return { balance: prevOverride, isActual: true };
      }
      // Current month: opening = currentBalance - net of all transactions this month
      const monthStart = startOfMonth(month);
      const transactionsThisMonth = allTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= monthStart;
      });
      const netThisMonth = transactionsThisMonth.reduce((sum, tx) => {
        const amount = Number(tx.amount);
        return sum + (tx.type === 'income' ? amount : -amount);
      }, 0);
      return { balance: currentBankBalance - netThisMonth, isActual: true };
    }
    
    if (isBefore(targetMonth, todayMonth)) {
      // Past month: check if we have a snapshot for the PREVIOUS month's end
      // Opening balance of month M = closing balance of month M-1
      const prevMonth = addMonths(targetMonth, -1);
      // Past month: check balance override for previous month first
      const prevOverride = getBalanceOverride(prevMonth);
      if (prevOverride !== null) {
        return { balance: prevOverride, isActual: true };
      }
      const prevSnapshot = getSnapshotForEndOfMonth(prevMonth);
      if (prevSnapshot !== null) {
        return { balance: prevSnapshot, isActual: true };
      }
      
      // Also check if we have a snapshot for the first day of this month
      const targetDateStr = format(targetMonth, 'yyyy-MM-dd');
      const firstDaySnapshots = balanceSnapshots.filter(s => s.snapshot_date === targetDateStr);
      if (firstDaySnapshots.length > 0) {
        const snapshotBalance = firstDaySnapshots.reduce((sum, s) => sum + Number(s.balance), 0);
        return { balance: snapshotBalance, isActual: true };
      }
      
      // Fallback: walk backwards from current balance (mark as estimated)
      const transactionsBetween = allTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= targetMonth && txDate < todayMonth;
      });
      const netBetween = transactionsBetween.reduce((sum, tx) => {
        const amount = Number(tx.amount);
        return sum + (tx.type === 'income' ? amount : -amount);
      }, 0);
      return { balance: currentBankBalance - netBetween, isActual: true, isEstimated: true };
    }
    
    // Future month: calculate projected balance
    let projectedBalance = currentBankBalance;
    for (let m = todayMonth; isBefore(m, targetMonth); m = addMonths(m, 1)) {
      const monthNet = getMonthNetForecast(m);
      projectedBalance += monthNet;
    }
    return { balance: projectedBalance, isActual: false };
  }, [currentCompany, liveBankBalance, allTransactions, balanceSnapshots, getSnapshotForEndOfMonth, getMonthNetForecast, getBalanceOverride]);

  // Helper to get total income forecast (HT) for a month - used for variable charge tooltips
  const getIncomeForecastTotal = useCallback((month: Date): number => {
    const monthStr = format(month, 'yyyy-MM-01');
    return categories
      .filter(c => c.type === 'income')
      .reduce((sum, c) => {
        const f = forecasts.find(fc => fc.category_id === c.id && fc.month === monthStr);
        return sum + (f?.expected_amount ?? 0);
      }, 0);
  }, [categories, forecasts]);

  // Helper to get closing balance (end of month) = opening balance + month net variation
  const getClosingBalance = useCallback((month: Date): { balance: number; forecastBalance?: number; isActual: boolean; isEstimated?: boolean } => {
    const opening = getOpeningBalance(month);
    const periodType = (() => {
      const todayMonth = startOfMonth(new Date());
      const target = startOfMonth(month);
      if (isBefore(target, todayMonth)) return 'past';
      if (isSameMonth(month, new Date())) return 'current';
      return 'future';
    })();

    if (periodType === 'past') {
      // Check manual override first
      const override = getBalanceOverride(month);
      if (override !== null) {
        return { balance: override, isActual: true };
      }
      // Check if we have a snapshot for this month's end
      const snapshot = getSnapshotForEndOfMonth(month);
      if (snapshot !== null) {
        return { balance: snapshot, isActual: true };
      }
      // Fallback to next month's opening (retro-calculated, mark as estimated)
      const nextMonth = addMonths(startOfMonth(month), 1);
      const nextOpening = getOpeningBalance(nextMonth);
      return { balance: nextOpening.balance, isActual: true, isEstimated: nextOpening.isEstimated };
    }

    if (periodType === 'current') {
      const nextMonth = addMonths(startOfMonth(month), 1);
      const nextOpening = getOpeningBalance(nextMonth);
      const netForecast = getMonthNetForecast(month);
      return { balance: nextOpening.balance, forecastBalance: opening.balance + netForecast, isActual: false };
    }

    // Future: opening + net forecast
    const netForecast = getMonthNetForecast(month);
    return { balance: opening.balance + netForecast, isActual: false };
  }, [getOpeningBalance, getMonthNetForecast, getSnapshotForEndOfMonth, getBalanceOverride]);

  return {
    months,
    forecasts,
    actuals,
    uncategorized,
    categories,
    isLoading: forecastsLoading || actualsLoading || uncategorizedLoading || payablesLoading || transactionsLoading,
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
