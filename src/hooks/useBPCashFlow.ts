import { useMemo } from 'react';
import { useProfitLoss } from './useProfitLoss';
import { useBPSettings } from './useBPSettings';

export interface CashFlowData {
  months: Date[];
  inflows: number[];
  outflows: number[];
  netFlow: number[];
  balance: number[];
  minBalance: number;
  monthsWithNegativeBalance: number;
}

export function useBPCashFlow() {
  const { data: plData, isLoading: plLoading } = useProfitLoss();
  const { settings, isLoading: settingsLoading } = useBPSettings();

  const isLoading = plLoading || settingsLoading;

  const data = useMemo<CashFlowData>(() => {
    // Flatten all months from all years
    const months = plData.years.flatMap(year => year.months);
    const customerDelay = Math.round((settings.customer_payment_delay || 30) / 30); // Convert days to months
    const supplierDelay = Math.round((settings.supplier_payment_delay || 30) / 30);
    const initialCash = Number(settings.initial_cash) || 0;

    // Get monthly values from yearly totals (distribute evenly for cash flow purposes)
    const monthlyRevenue: number[] = [];
    const monthlyFixedExpenses: number[] = [];
    const monthlyPersonnelCosts: number[] = [];

    plData.years.forEach((year, yearIndex) => {
      const monthCount = year.months.length;
      const yearRevenue = plData.totals.revenue[yearIndex] || 0;
      const yearFixed = plData.totals.fixedExpenses[yearIndex] || 0;
      const yearPersonnel = plData.totals.personnelCosts[yearIndex] || 0;

      // Distribute yearly values evenly across months
      for (let i = 0; i < monthCount; i++) {
        monthlyRevenue.push(yearRevenue / monthCount);
        monthlyFixedExpenses.push(yearFixed / monthCount);
        monthlyPersonnelCosts.push(yearPersonnel / monthCount);
      }
    });

    // Apply payment delays
    // Inflows = revenue shifted by customer delay
    const inflows = months.map((_, i) => {
      const sourceIndex = i - customerDelay;
      return sourceIndex >= 0 ? monthlyRevenue[sourceIndex] : 0;
    });

    // Outflows = expenses shifted by supplier delay
    const outflows = months.map((_, i) => {
      const sourceIndex = i - supplierDelay;
      if (sourceIndex >= 0) {
        return monthlyFixedExpenses[sourceIndex] + monthlyPersonnelCosts[sourceIndex];
      }
      return 0;
    });

    // Net flow for each month
    const netFlow = months.map((_, i) => inflows[i] - outflows[i]);

    // Running balance
    const balance: number[] = [];
    let runningBalance = initialCash;
    netFlow.forEach(nf => {
      runningBalance += nf;
      balance.push(runningBalance);
    });

    // Stats
    const minBalance = Math.min(...balance);
    const monthsWithNegativeBalance = balance.filter(b => b < 0).length;

    return {
      months,
      inflows,
      outflows,
      netFlow,
      balance,
      minBalance,
      monthsWithNegativeBalance,
    };
  }, [plData, settings]);

  // Helper: check if cash flow is healthy
  const isHealthy = (): boolean => {
    return data.minBalance >= 0;
  };

  // Helper: get minimum required initial cash to stay positive
  const getMinimumInitialCash = (): number => {
    const initialCash = Number(settings.initial_cash) || 0;
    if (data.minBalance >= 0) return 0;
    return Math.abs(data.minBalance) + initialCash;
  };

  return {
    data,
    isLoading,
    isHealthy,
    getMinimumInitialCash,
  };
}