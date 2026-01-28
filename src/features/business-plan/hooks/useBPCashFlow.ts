import { useMemo } from 'react';
import { useProfitLoss } from './useProfitLoss';
import { useBPSettings } from './useBPSettings';
import { useFinancings } from './useFinancings';

export interface CashFlowData {
  months: Date[];
  inflows: number[];
  outflows: number[];
  netFlow: number[];
  balance: number[];
  minBalance: number;
  monthsWithNegativeBalance: number;
  // Detailed breakdowns
  loanDisbursements: number[];
  loanPayments: number[];
  leasePayments: number[];
  severancePayments: number[];
}

export function useBPCashFlow() {
  const { data: plData, isLoading: plLoading } = useProfitLoss();
  const { settings, isLoading: settingsLoading } = useBPSettings();
  const { 
    getLoanDisbursements, 
    getMonthlyLoanPayments, 
    getMonthlyLeasePayments,
    isLoading: financingsLoading 
  } = useFinancings();

  const isLoading = plLoading || settingsLoading || financingsLoading;
  const showFinancing = settings.show_financing !== false;

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
    const monthlySeverancePayments: number[] = [];

    plData.years.forEach((year, yearIndex) => {
      const monthCount = year.months.length;
      const yearRevenue = plData.totals.revenue[yearIndex] || 0;
      const yearFixed = plData.totals.fixedExpenses[yearIndex] || 0;
      const yearPersonnel = plData.totals.personnelCosts[yearIndex] || 0;
      const yearSeverance = plData.totals.severancePayments?.[yearIndex] || 0;

      // Distribute yearly values evenly across months
      for (let i = 0; i < monthCount; i++) {
        monthlyRevenue.push(yearRevenue / monthCount);
        monthlyFixedExpenses.push(yearFixed / monthCount);
        monthlyPersonnelCosts.push(yearPersonnel / monthCount);
        monthlySeverancePayments.push(yearSeverance / monthCount);
      }
    });

    // Calculate financing flows for each month (only if show_financing is enabled)
    const loanDisbursements = showFinancing ? months.map(month => getLoanDisbursements(month)) : months.map(() => 0);
    const loanPayments = showFinancing ? months.map(month => getMonthlyLoanPayments(month)) : months.map(() => 0);
    const leasePayments = showFinancing ? months.map(month => getMonthlyLeasePayments(month)) : months.map(() => 0);
    
    // Severance payments (no delay - paid on departure date)
    const severancePayments = monthlySeverancePayments;

    // Apply payment delays
    // Inflows = revenue shifted by customer delay + loan disbursements
    const inflows = months.map((_, i) => {
      const sourceIndex = i - customerDelay;
      const revenue = sourceIndex >= 0 ? monthlyRevenue[sourceIndex] : 0;
      const loans = loanDisbursements[i] || 0;
      return revenue + loans;
    });

    // Outflows = expenses shifted by supplier delay + financing payments + severance
    const outflows = months.map((_, i) => {
      const sourceIndex = i - supplierDelay;
      let expenses = 0;
      if (sourceIndex >= 0) {
        expenses = monthlyFixedExpenses[sourceIndex] + monthlyPersonnelCosts[sourceIndex];
      }
      // Add financing payments (not delayed - they're contractual)
      const financing = (loanPayments[i] || 0) + (leasePayments[i] || 0);
      // Add severance payments (not delayed - paid on departure)
      const severance = severancePayments[i] || 0;
      return expenses + financing + severance;
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
    const minBalance = balance.length > 0 ? Math.min(...balance) : 0;
    const monthsWithNegativeBalance = balance.filter(b => b < 0).length;

    return {
      months,
      inflows,
      outflows,
      netFlow,
      balance,
      minBalance,
      monthsWithNegativeBalance,
      loanDisbursements,
      loanPayments,
      leasePayments,
      severancePayments,
    };
  }, [plData, settings, getLoanDisbursements, getMonthlyLoanPayments, getMonthlyLeasePayments]);

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