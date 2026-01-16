import { useMemo } from 'react';
import { useProfitLoss } from './useProfitLoss';
import { useBalanceSheet } from './useBalanceSheet';
import { useFinancings } from './useFinancings';

export interface FinancialRatios {
  // Profitability Ratios
  grossMargin: number[];
  operatingMargin: number[];
  netMargin: number[];
  roe: number[]; // Return on Equity
  roa: number[]; // Return on Assets

  // Liquidity Ratios
  currentRatio: number[];
  quickRatio: number[];
  cashRatio: number[];

  // Leverage/Debt Ratios
  debtToEquity: number[];
  debtToAssets: number[];
  interestCoverage: number[];
  
  // Activity Ratios
  dso: number[]; // Days Sales Outstanding
  dpo: number[]; // Days Payable Outstanding
  cashConversionCycle: number[];

  // Break-even
  breakEvenRevenue: number[];
  breakEvenMonths: number[];
  safetyMargin: number[];
}

export interface BreakEvenData {
  revenue: number;
  fixedCosts: number;
  variableCosts: number;
  breakEvenPoint: number;
  breakEvenMonths: number;
  safetyMarginPercent: number;
}

export function useBPRatios() {
  const { data: plData, isLoading: plLoading } = useProfitLoss();
  const { data: bsData, isLoading: bsLoading } = useBalanceSheet();
  const { getMonthlyInterestExpense, isLoading: financingsLoading } = useFinancings();

  const isLoading = plLoading || bsLoading || financingsLoading;

  const ratios = useMemo<FinancialRatios>(() => {
    const years = plData.years;

    // ═══════════════════════════════════════════════════════════════
    // PROFITABILITY RATIOS
    // ═══════════════════════════════════════════════════════════════
    const grossMargin = years.map((_, i) => {
      const revenue = plData.totals.revenue[i] || 0;
      const variable = plData.totals.variableExpenses[i] || 0;
      return revenue > 0 ? ((revenue - variable) / revenue) * 100 : 0;
    });

    const operatingMargin = years.map((_, i) => {
      const revenue = plData.totals.revenue[i] || 0;
      const opResult = plData.totals.operatingResult?.[i] || plData.totals.ebitda[i] || 0;
      return revenue > 0 ? (opResult / revenue) * 100 : 0;
    });

    const netMargin = years.map((_, i) => {
      const revenue = plData.totals.revenue[i] || 0;
      const netResult = plData.totals.netResult[i] || 0;
      return revenue > 0 ? (netResult / revenue) * 100 : 0;
    });

    const roe = years.map((_, i) => {
      const netResult = plData.totals.netResult[i] || 0;
      const equity = bsData.totals.equity[i] || 1;
      return equity > 0 ? (netResult / equity) * 100 : 0;
    });

    const roa = years.map((_, i) => {
      const netResult = plData.totals.netResult[i] || 0;
      const assets = bsData.totals.totalAssets[i] || 1;
      return assets > 0 ? (netResult / assets) * 100 : 0;
    });

    // ═══════════════════════════════════════════════════════════════
    // LIQUIDITY RATIOS
    // ═══════════════════════════════════════════════════════════════
    const currentRatio = years.map((_, i) => {
      const currentAssets = bsData.totals.currentAssets[i] || 0;
      const currentLiabilities = bsData.totals.operatingDebts[i] || 1;
      return currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    });

    const quickRatio = years.map((_, i) => {
      const currentAssets = bsData.totals.currentAssets[i] || 0;
      const cash = bsData.cash[i] || 0;
      const currentLiabilities = bsData.totals.operatingDebts[i] || 1;
      // Quick assets = current assets - stocks (approximated)
      const quickAssets = currentAssets - (currentAssets - cash) * 0.3; // Rough estimate
      return currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;
    });

    const cashRatio = years.map((_, i) => {
      const cash = bsData.cash[i] || 0;
      const currentLiabilities = bsData.totals.operatingDebts[i] || 1;
      return currentLiabilities > 0 ? cash / currentLiabilities : 0;
    });

    // ═══════════════════════════════════════════════════════════════
    // LEVERAGE RATIOS
    // ═══════════════════════════════════════════════════════════════
    const debtToEquity = years.map((_, i) => {
      const debt = bsData.totals.financialDebts[i] || 0;
      const equity = bsData.totals.equity[i] || 1;
      return equity > 0 ? debt / equity : 0;
    });

    const debtToAssets = years.map((_, i) => {
      const debt = bsData.totals.financialDebts[i] || 0;
      const assets = bsData.totals.totalAssets[i] || 1;
      return assets > 0 ? (debt / assets) * 100 : 0;
    });

    const interestCoverage = years.map((_, i) => {
      const ebitda = plData.totals.ebitda[i] || 0;
      const financialResult = Math.abs(plData.totals.financialResult?.[i] || 0);
      return financialResult > 0 ? ebitda / financialResult : ebitda > 0 ? 999 : 0;
    });

    // ═══════════════════════════════════════════════════════════════
    // ACTIVITY RATIOS
    // ═══════════════════════════════════════════════════════════════
    const dso = years.map((_, i) => {
      const revenue = plData.totals.revenue[i] || 0;
      // Estimate receivables based on 30 days average
      const receivables = revenue / 12 * 1; // 1 month
      return revenue > 0 ? (receivables / revenue) * 365 : 0;
    });

    const dpo = years.map((_, i) => {
      const expenses = (plData.totals.fixedExpenses[i] || 0) + (plData.totals.variableExpenses[i] || 0);
      const payables = expenses / 12 * 1; // 1 month
      return expenses > 0 ? (payables / expenses) * 365 : 0;
    });

    const cashConversionCycle = years.map((_, i) => dso[i] - dpo[i]);

    // ═══════════════════════════════════════════════════════════════
    // BREAK-EVEN ANALYSIS
    // ═══════════════════════════════════════════════════════════════
    const breakEvenRevenue = years.map((_, i) => {
      const fixedCosts = (plData.totals.fixedExpenses[i] || 0) + 
                         (plData.totals.personnelCosts[i] || 0) +
                         (plData.totals.directorsCosts[i] || 0) +
                         (plData.totals.depreciation[i] || 0);
      const revenue = plData.totals.revenue[i] || 0;
      const variableCosts = plData.totals.variableExpenses[i] || 0;
      const contributionMarginRatio = revenue > 0 ? (revenue - variableCosts) / revenue : 0;
      return contributionMarginRatio > 0 ? fixedCosts / contributionMarginRatio : 0;
    });

    const breakEvenMonths = years.map((_, i) => {
      const revenue = plData.totals.revenue[i] || 0;
      const be = breakEvenRevenue[i];
      const monthlyRevenue = revenue / 12;
      return monthlyRevenue > 0 ? Math.ceil(be / monthlyRevenue) : 12;
    });

    const safetyMargin = years.map((_, i) => {
      const revenue = plData.totals.revenue[i] || 0;
      const be = breakEvenRevenue[i];
      return revenue > 0 ? ((revenue - be) / revenue) * 100 : 0;
    });

    return {
      grossMargin,
      operatingMargin,
      netMargin,
      roe,
      roa,
      currentRatio,
      quickRatio,
      cashRatio,
      debtToEquity,
      debtToAssets,
      interestCoverage,
      dso,
      dpo,
      cashConversionCycle,
      breakEvenRevenue,
      breakEvenMonths,
      safetyMargin,
    };
  }, [plData, bsData]);

  // Get break-even data for a specific year
  const getBreakEvenData = (yearIndex: number): BreakEvenData => {
    const revenue = plData.totals.revenue[yearIndex] || 0;
    const fixedCosts = (plData.totals.fixedExpenses[yearIndex] || 0) + 
                       (plData.totals.personnelCosts[yearIndex] || 0) +
                       (plData.totals.directorsCosts[yearIndex] || 0) +
                       (plData.totals.depreciation[yearIndex] || 0);
    const variableCosts = plData.totals.variableExpenses[yearIndex] || 0;

    return {
      revenue,
      fixedCosts,
      variableCosts,
      breakEvenPoint: ratios.breakEvenRevenue[yearIndex],
      breakEvenMonths: ratios.breakEvenMonths[yearIndex],
      safetyMarginPercent: ratios.safetyMargin[yearIndex],
    };
  };

  // Get ratio status (good/warning/bad)
  const getRatioStatus = (ratio: string, value: number): 'good' | 'warning' | 'bad' => {
    switch (ratio) {
      case 'currentRatio':
        if (value >= 2) return 'good';
        if (value >= 1) return 'warning';
        return 'bad';
      case 'debtToEquity':
        if (value <= 1) return 'good';
        if (value <= 2) return 'warning';
        return 'bad';
      case 'netMargin':
        if (value >= 10) return 'good';
        if (value >= 5) return 'warning';
        return value >= 0 ? 'warning' : 'bad';
      case 'interestCoverage':
        if (value >= 3) return 'good';
        if (value >= 1.5) return 'warning';
        return 'bad';
      default:
        return 'warning';
    }
  };

  return {
    ratios,
    isLoading,
    getBreakEvenData,
    getRatioStatus,
  };
}
