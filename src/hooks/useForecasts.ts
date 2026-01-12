import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { addMonths, startOfMonth, format } from 'date-fns';

export interface CategoryForecast {
  id: string;
  user_id: string;
  category_id: string;
  month: string;
  expected_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastWithActual extends CategoryForecast {
  actual_amount: number;
}

export function useForecasts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get the next 6 months starting from current month
  const getNext6Months = () => {
    const months: Date[] = [];
    const today = startOfMonth(new Date());
    for (let i = 0; i < 6; i++) {
      months.push(addMonths(today, i));
    }
    return months;
  };

  const months = getNext6Months();

  // Fetch category forecasts
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['category-forecasts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const startMonth = format(months[0], 'yyyy-MM-01');
      const endMonth = format(months[months.length - 1], 'yyyy-MM-01');
      
      const { data, error } = await supabase
        .from('category_forecasts')
        .select('*')
        .gte('month', startMonth)
        .lte('month', endMonth)
        .order('month');
      
      if (error) throw error;
      return data as CategoryForecast[];
    },
    enabled: !!user?.id,
  });

  // Fetch actual amounts from transactions grouped by category and month
  const { data: actuals = [], isLoading: actualsLoading } = useQuery({
    queryKey: ['category-actuals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const startMonth = format(months[0], 'yyyy-MM-01');
      const endMonth = format(addMonths(months[months.length - 1], 1), 'yyyy-MM-01');
      
      const { data, error } = await supabase
        .from('transactions')
        .select('category_id, amount, date, type')
        .gte('date', startMonth)
        .lt('date', endMonth);
      
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
    enabled: !!user?.id,
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
      if (!user?.id) throw new Error('Non authentifié');
      
      const monthStr = format(month, 'yyyy-MM-01');
      
      const { data, error } = await supabase
        .from('category_forecasts')
        .upsert({
          user_id: user.id,
          category_id: categoryId,
          month: monthStr,
          expected_amount: expectedAmount,
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

  // Helper to get actual amount for a specific category and month
  const getActual = (categoryId: string, month: Date): number => {
    const monthStr = format(month, 'yyyy-MM-01');
    return actuals[categoryId]?.[monthStr] ?? 0;
  };

  return {
    months,
    forecasts,
    actuals,
    isLoading: forecastsLoading || actualsLoading,
    upsertForecast,
    getForecast,
    getActual,
  };
}
