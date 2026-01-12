import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { startOfMonth, endOfMonth, subMonths, format, addMonths, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardStats {
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  previousMonthIncome: number;
  previousMonthExpense: number;
  forecast90Days: number;
  loading: boolean;
}

interface BalanceDataPoint {
  month: string;
  balance: number;
  income: number;
  expense: number;
  isProjection: boolean;
}

interface ExpenseByCategory {
  name: string;
  value: number;
  color: string;
}

export function useDashboardStats() {
  const { currentCompany } = useCompany();
  const [stats, setStats] = useState<DashboardStats>({
    currentBalance: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    previousMonthIncome: 0,
    previousMonthExpense: 0,
    forecast90Days: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      setStats(prev => ({ ...prev, loading: true }));
      
      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const previousMonthEnd = endOfMonth(subMonths(now, 1));

      try {
        // Fetch all transactions for calculations
        let query = supabase
          .from('transactions')
          .select('amount, type, date');

        if (currentCompany?.id) {
          query = query.eq('company_id', currentCompany.id);
        }

        const { data: transactions, error } = await query;

        if (error) {
          console.error('Error fetching transactions:', error);
          return;
        }

        // Current month stats
        const currentMonthTransactions = transactions?.filter(t => {
          const date = new Date(t.date);
          return date >= currentMonthStart && date <= currentMonthEnd;
        }) || [];

        const monthlyIncome = currentMonthTransactions
          .filter(t => t.type === 'income')
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const monthlyExpense = currentMonthTransactions
          .filter(t => t.type === 'expense')
          .reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);

        // Previous month stats
        const previousMonthTransactions = transactions?.filter(t => {
          const date = new Date(t.date);
          return date >= previousMonthStart && date <= previousMonthEnd;
        }) || [];

        const previousMonthIncome = previousMonthTransactions
          .filter(t => t.type === 'income')
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const previousMonthExpense = previousMonthTransactions
          .filter(t => t.type === 'expense')
          .reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);

        // Current balance (sum of all transactions)
        const currentBalance = transactions?.reduce((acc, t) => {
          if (t.type === 'income') {
            return acc + Number(t.amount);
          } else {
            return acc - Math.abs(Number(t.amount));
          }
        }, 0) || 0;

        // 90-day forecast - use forecasts table
        let forecastQuery = supabase
          .from('forecasts')
          .select('expected_income, expected_expense, month')
          .gte('month', format(now, 'yyyy-MM-dd'))
          .lte('month', format(addMonths(now, 3), 'yyyy-MM-dd'));

        if (currentCompany?.id) {
          forecastQuery = forecastQuery.eq('company_id', currentCompany.id);
        }

        const { data: forecasts } = await forecastQuery;

        const forecastNet = forecasts?.reduce((acc, f) => {
          return acc + Number(f.expected_income) - Number(f.expected_expense);
        }, 0) || 0;

        const forecast90Days = currentBalance + forecastNet;

        setStats({
          currentBalance,
          monthlyIncome,
          monthlyExpense,
          previousMonthIncome,
          previousMonthExpense,
          forecast90Days,
          loading: false,
        });
      } catch (error) {
        console.error('Error calculating stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, [currentCompany?.id]);

  const incomeChange = useMemo(() => {
    if (stats.previousMonthIncome === 0) return { value: '+0%', type: 'neutral' as const };
    const change = ((stats.monthlyIncome - stats.previousMonthIncome) / stats.previousMonthIncome) * 100;
    return {
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      type: change >= 0 ? 'positive' as const : 'negative' as const,
    };
  }, [stats.monthlyIncome, stats.previousMonthIncome]);

  const expenseChange = useMemo(() => {
    if (stats.previousMonthExpense === 0) return { value: '+0%', type: 'neutral' as const };
    const change = ((stats.monthlyExpense - stats.previousMonthExpense) / stats.previousMonthExpense) * 100;
    // For expenses, decrease is positive
    return {
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      type: change <= 0 ? 'positive' as const : 'negative' as const,
    };
  }, [stats.monthlyExpense, stats.previousMonthExpense]);

  return {
    ...stats,
    incomeChange,
    expenseChange,
  };
}

export function useBalanceChartData() {
  const { currentCompany } = useCompany();
  const [data, setData] = useState<BalanceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const now = new Date();
      
      try {
        // Fetch all transactions
        let transactionsQuery = supabase
          .from('transactions')
          .select('amount, type, date');

        if (currentCompany?.id) {
          transactionsQuery = transactionsQuery.eq('company_id', currentCompany.id);
        }

        const { data: transactions } = await transactionsQuery;

        // Fetch forecasts for future months
        let forecastsQuery = supabase
          .from('forecasts')
          .select('expected_income, expected_expense, month')
          .gte('month', format(now, 'yyyy-MM-01'));

        if (currentCompany?.id) {
          forecastsQuery = forecastsQuery.eq('company_id', currentCompany.id);
        }

        const { data: forecasts } = await forecastsQuery;

        // Calculate current balance
        const currentBalance = transactions?.reduce((acc, t) => {
          if (t.type === 'income') {
            return acc + Number(t.amount);
          } else {
            return acc - Math.abs(Number(t.amount));
          }
        }, 0) || 0;

        // Group past transactions by month (last 6 months)
        const monthlyData: Record<string, { income: number; expense: number }> = {};
        
        for (let i = 5; i >= 0; i--) {
          const monthDate = subMonths(now, i);
          const monthKey = format(monthDate, 'yyyy-MM');
          monthlyData[monthKey] = { income: 0, expense: 0 };
        }

        transactions?.forEach(t => {
          const monthKey = format(parseISO(t.date), 'yyyy-MM');
          if (monthlyData[monthKey]) {
            if (t.type === 'income') {
              monthlyData[monthKey].income += Number(t.amount);
            } else {
              monthlyData[monthKey].expense += Math.abs(Number(t.amount));
            }
          }
        });

        // Build chart data
        const chartData: BalanceDataPoint[] = [];
        let runningBalance = currentBalance;

        // First, calculate what the balance was 6 months ago
        const pastMonths = Object.keys(monthlyData).sort();
        const totalPastNet = pastMonths.reduce((acc, month) => {
          return acc + monthlyData[month].income - monthlyData[month].expense;
        }, 0);
        
        runningBalance = currentBalance - totalPastNet;

        // Add past months
        pastMonths.forEach(monthKey => {
          const monthDate = parseISO(`${monthKey}-01`);
          const { income, expense } = monthlyData[monthKey];
          runningBalance += income - expense;
          
          chartData.push({
            month: format(monthDate, 'MMM yyyy', { locale: fr }),
            balance: runningBalance,
            income,
            expense,
            isProjection: false,
          });
        });

        // Add future months from forecasts (next 6 months)
        for (let i = 1; i <= 6; i++) {
          const futureDate = addMonths(now, i);
          const monthKey = format(futureDate, 'yyyy-MM');
          
          const forecast = forecasts?.find(f => f.month.startsWith(monthKey));
          const income = forecast ? Number(forecast.expected_income) : 0;
          const expense = forecast ? Number(forecast.expected_expense) : 0;
          
          runningBalance += income - expense;
          
          chartData.push({
            month: format(futureDate, 'MMM yyyy', { locale: fr }),
            balance: runningBalance,
            income,
            expense,
            isProjection: true,
          });
        }

        setData(chartData);
      } catch (error) {
        console.error('Error fetching balance chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentCompany?.id]);

  return { data, loading };
}

export function useCategoryBreakdown() {
  const { currentCompany } = useCompany();
  const [data, setData] = useState<ExpenseByCategory[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

      try {
        // Fetch transactions with categories for current month
        let query = supabase
          .from('transactions')
          .select(`
            amount,
            type,
            category_id,
            categories (
              name,
              color
            )
          `)
          .eq('type', 'expense')
          .gte('date', monthStart)
          .lte('date', monthEnd);

        if (currentCompany?.id) {
          query = query.eq('company_id', currentCompany.id);
        }

        const { data: transactions } = await query;

        // Group by category
        const categoryTotals: Record<string, { value: number; color: string }> = {};
        
        transactions?.forEach((t: any) => {
          const categoryName = t.categories?.name || 'Non catégorisé';
          const categoryColor = t.categories?.color || 'hsl(220, 14%, 96%)';
          
          if (!categoryTotals[categoryName]) {
            categoryTotals[categoryName] = { value: 0, color: categoryColor };
          }
          categoryTotals[categoryName].value += Math.abs(Number(t.amount));
        });

        const chartData = Object.entries(categoryTotals).map(([name, { value, color }]) => ({
          name,
          value,
          color,
        }));

        const total = chartData.reduce((acc, d) => acc + d.value, 0);

        setData(chartData);
        setTotalExpense(total);
      } catch (error) {
        console.error('Error fetching category breakdown:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentCompany?.id]);

  return { data, totalExpense, loading };
}
