import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useForecasts } from '@/hooks/useForecasts';
import { useCategories } from '@/hooks/useCategories';
import { ForecastChart } from '@/components/forecasts/ForecastChart';
import { Skeleton } from '@/components/ui/skeleton';
import { isBefore, startOfMonth, isSameMonth } from 'date-fns';

export function BalanceChart() {
  const {
    months,
    isLoading,
    getClosingBalance,
    getForecast,
    getActual,
    getUncategorized,
    getNetVatForecast,
    getMonthProjected,
  } = useForecasts();

  const { categories } = useCategories();

  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);
  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);

  const getMonthTotal = useCallback((type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => {
    const cats = type === 'income' ? incomeCategories : expenseCategories;
    return cats.reduce((sum, cat) => {
      if (valueType === 'forecast') {
        return sum + getForecast(cat.id, months[monthIndex]);
      }
      return sum + Math.abs(getActual(cat.id, months[monthIndex]));
    }, 0);
  }, [incomeCategories, expenseCategories, getForecast, getActual, months]);

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate stats from chart data
  const stats = useMemo(() => {
    if (!months.length) return { minBalance: 0, maxBalance: 0, trendPercent: '0', isPositiveTrend: true };

    const today = startOfMonth(new Date());
    const balances = months.map(month => {
      const closingData = getClosingBalance(month);
      const isCurrent = isSameMonth(month, today);
      if (isCurrent) {
        return closingData.projectedBalance ?? closingData.forecastBalance ?? closingData.balance;
      }
      return closingData.balance;
    });

    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);

    // Find current month index for trend
    const currentIdx = months.findIndex(m => isSameMonth(m, today));
    const lastIdx = balances.length - 1;
    const currentBalance = currentIdx >= 0 ? balances[currentIdx] : balances[0];
    const lastBalance = balances[lastIdx];
    const trendPercent = currentBalance > 0
      ? ((lastBalance - currentBalance) / currentBalance * 100).toFixed(0)
      : '0';

    return {
      minBalance,
      maxBalance,
      trendPercent,
      isPositiveTrend: Number(trendPercent) >= 0,
    };
  }, [months, getClosingBalance]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-card p-6"
      >
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-80 w-full" />
      </motion.div>
    );
  }

  if (months.length === 0) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground">Projection de trésorerie</h3>
        <p className="text-sm text-muted-foreground mb-6">Vision sur 12 mois glissants</p>
        <div className="h-80 flex items-center justify-center text-muted-foreground">
          Aucune donnée disponible. Synchronisez vos transactions pour commencer.
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      {/* Reuse the exact same chart from the forecast page */}
      <ForecastChart
        months={months}
        getMonthTotal={getMonthTotal}
        getMonthProjected={getMonthProjected}
        getClosingBalance={getClosingBalance}
        getUncategorized={getUncategorized}
        getNetVatForecast={getNetVatForecast}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 -mt-2 bg-card rounded-2xl border border-border shadow-card p-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Solde min prévu</p>
          <p className="text-lg font-semibold text-foreground">{formatTooltipValue(stats.minBalance)}</p>
        </div>
        <div className="text-center border-x border-border">
          <p className="text-sm text-muted-foreground">Solde max prévu</p>
          <p className="text-lg font-semibold text-foreground">{formatTooltipValue(stats.maxBalance)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Tendance</p>
          <p className={`text-lg font-semibold flex items-center justify-center gap-1 ${stats.isPositiveTrend ? 'text-success' : 'text-destructive'}`}>
            {stats.isPositiveTrend ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {stats.isPositiveTrend ? '+' : ''}{stats.trendPercent}%
          </p>
        </div>
      </div>
    </motion.div>
  );
}
