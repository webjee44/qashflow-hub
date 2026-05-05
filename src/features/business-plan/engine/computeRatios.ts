// computeRatios — pure (parity with useBPRatios)
import type { PLData } from '../hooks/useProfitLoss';
import type { BalanceSheetData } from '@/hooks/useBalanceSheet';
import type { FinancialRatios, BreakEvenData } from '../hooks/useBPRatios';

export function computeRatios(plData: PLData, bsData: BalanceSheetData): {
  ratios: FinancialRatios;
  getBreakEvenData: (yearIndex: number) => BreakEvenData;
} {
  const years = plData.years;

  const grossMargin = years.map((_, i) => {
    const revenue = plData.totals.revenue[i] || 0;
    const cogs = plData.totals.cogs?.[i] || 0;
    return revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
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

  const currentRatio = years.map((_, i) => {
    const currentAssets = bsData.totals.currentAssets[i] || 0;
    const currentLiabilities = bsData.totals.operatingDebts[i] || 1;
    return currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  });
  const quickRatio = years.map((_, i) => {
    const currentAssets = bsData.totals.currentAssets[i] || 0;
    const cash = bsData.cash[i] || 0;
    const currentLiabilities = bsData.totals.operatingDebts[i] || 1;
    const quickAssets = currentAssets - (currentAssets - cash) * 0.3;
    return currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;
  });
  const cashRatio = years.map((_, i) => {
    const cash = bsData.cash[i] || 0;
    const currentLiabilities = bsData.totals.operatingDebts[i] || 1;
    return currentLiabilities > 0 ? cash / currentLiabilities : 0;
  });

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

  const dso = years.map((_, i) => {
    const revenue = plData.totals.revenue[i] || 0;
    const receivables = revenue / 12;
    return revenue > 0 ? (receivables / revenue) * 365 : 0;
  });
  const dpo = years.map((_, i) => {
    const expenses = (plData.totals.fixedExpenses[i] || 0) + (plData.totals.variableExpenses[i] || 0);
    const payables = expenses / 12;
    return expenses > 0 ? (payables / expenses) * 365 : 0;
  });
  const cashConversionCycle = years.map((_, i) => dso[i] - dpo[i]);

  const breakEvenRevenue = years.map((_, i) => {
    const fixedCosts = (plData.totals.fixedExpenses[i] || 0) +
      (plData.totals.personnelCosts[i] || 0) +
      (plData.totals.directorsCosts[i] || 0) +
      (plData.totals.depreciation[i] || 0) +
      (plData.totals.leaseExpenses?.[i] || 0) +
      (plData.totals.payrollTaxes?.[i] || 0);
    const revenue = plData.totals.revenue[i] || 0;
    const cogs = plData.totals.cogs?.[i] || 0;
    const contributionMarginRatio = revenue > 0 ? (revenue - cogs) / revenue : 0;
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

  const ratios: FinancialRatios = {
    grossMargin, operatingMargin, netMargin, roe, roa,
    currentRatio, quickRatio, cashRatio,
    debtToEquity, debtToAssets, interestCoverage,
    dso, dpo, cashConversionCycle,
    breakEvenRevenue, breakEvenMonths, safetyMargin,
  };

  const getBreakEvenData = (yearIndex: number): BreakEvenData => {
    const revenue = plData.totals.revenue[yearIndex] || 0;
    const fixedCosts = (plData.totals.fixedExpenses[yearIndex] || 0) +
      (plData.totals.personnelCosts[yearIndex] || 0) +
      (plData.totals.directorsCosts[yearIndex] || 0) +
      (plData.totals.depreciation[yearIndex] || 0) +
      (plData.totals.leaseExpenses?.[yearIndex] || 0) +
      (plData.totals.payrollTaxes?.[yearIndex] || 0);
    const variableCosts = plData.totals.cogs?.[yearIndex] || 0;
    return {
      revenue, fixedCosts, variableCosts,
      breakEvenPoint: ratios.breakEvenRevenue[yearIndex],
      breakEvenMonths: ratios.breakEvenMonths[yearIndex],
      safetyMarginPercent: ratios.safetyMargin[yearIndex],
    };
  };

  return { ratios, getBreakEvenData };
}
