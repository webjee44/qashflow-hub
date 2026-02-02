import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { useCategories, Category } from './useCategories';
import { toast } from 'sonner';
import { addMonths, startOfMonth, format, differenceInMonths } from 'date-fns';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

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
    return stored !== null ? parseInt(stored, 10) : defaultValue;
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
      
      let query = supabase
        .from('category_forecasts')
        .select('*')
        .gte('month', startMonthStr)
        .lte('month', endMonthStr)
        .order('month');

      // Filter by company if one is selected
      if (currentCompany) {
        query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as CategoryForecast[];
    },
    enabled: !!user?.id && !!startMonthStr,
  });

  // Fetch actual amounts from transactions grouped by category and month
  const { data: actuals = [], isLoading: actualsLoading } = useQuery({
    queryKey: ['category-actuals', user?.id, currentCompany?.id, startMonthStr, endMonthStr],
    queryFn: async () => {
      if (!user?.id || !startMonthStr) return [];
      
      const endMonthPlusOne = format(addMonths(months[months.length - 1], 1), 'yyyy-MM-01');
      
      let query = supabase
        .from('transactions')
        .select('category_id, amount, date, type')
        .gte('date', startMonthStr)
        .lt('date', endMonthPlusOne)
        .is('deleted_at', null);

      // Filter by company if one is selected
      if (currentCompany) {
        query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Group by category and month
      const grouped: Record<string, Record<string, number>> = {};
      
      data?.forEach((tx) => {
        if (!tx.category_id) return;
        
        const monthKey = format(new Date(tx.date), 'yyyy-MM-01');
        if (!grouped[tx.category_id]) {
          grouped[tx.category_id] = {};
        }
        if (!grouped[tx.category_id][monthKey]) {
          grouped[tx.category_id][monthKey] = 0;
        }
        // Use absolute value for expenses, positive for income
        grouped[tx.category_id][monthKey] += Number(tx.amount);
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
      
      let query = supabase
        .from('transactions')
        .select('amount, date, type')
        .gte('date', startMonthStr)
        .lt('date', endMonthPlusOne)
        .is('category_id', null)
        .is('deleted_at', null);

      // Filter by company if one is selected
      if (currentCompany) {
        query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
      }
      
      const { data, error } = await query;
      
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

  // Helper to get forecast for a specific category and month
  const getForecast = (categoryId: string, month: Date): number => {
    const monthStr = format(month, 'yyyy-MM-01');
    const forecast = forecasts.find(
      f => f.category_id === categoryId && f.month === monthStr
    );
    return forecast?.expected_amount ?? 0;
  };

  // Helper to get forecast source for a specific category and month
  const getForecastSource = (categoryId: string, month: Date): 'manual' | 'bp_import' | 'bp_synced' | null => {
    const monthStr = format(month, 'yyyy-MM-01');
    const forecast = forecasts.find(
      f => f.category_id === categoryId && f.month === monthStr
    );
    return forecast?.source || null;
  };

  // Helper to get actual amount for a specific category and month
  const getActual = (categoryId: string, month: Date): number => {
    const monthStr = format(month, 'yyyy-MM-01');
    return actuals[categoryId]?.[monthStr] ?? 0;
  };

  // Helper to calculate VAT forecast for a type (income/expense) and month
  const getVatForecast = (type: 'income' | 'expense', month: Date): number => {
    const typedCategories = categories.filter(c => c.type === type);
    return typedCategories.reduce((sum, cat) => {
      const forecast = getForecast(cat.id, month);
      const vatAmount = forecast * cat.vat_rate;
      return sum + vatAmount;
    }, 0);
  };

  // Helper to calculate VAT actual for a type (income/expense) and month
  const getVatActual = (type: 'income' | 'expense', month: Date): number => {
    const typedCategories = categories.filter(c => c.type === type);
    return typedCategories.reduce((sum, cat) => {
      const actual = Math.abs(getActual(cat.id, month));
      const vatAmount = actual * cat.vat_rate;
      return sum + vatAmount;
    }, 0);
  };

  // Helper to get uncategorized amounts for a month
  const getUncategorized = (type: 'income' | 'expense', month: Date): number => {
    const monthStr = format(month, 'yyyy-MM-01');
    return uncategorized[monthStr]?.[type] ?? 0;
  };

  return {
    months,
    forecasts,
    actuals,
    uncategorized,
    categories,
    isLoading: forecastsLoading || actualsLoading || uncategorizedLoading,
    upsertForecast,
    getForecast,
    getForecastSource,
    getActual,
    getVatForecast,
    getVatActual,
    getUncategorized,
    // Period controls
    extendBefore,
    extendAfter,
    resetPeriod,
    monthsBefore,
    monthsAfter,
  };
}
