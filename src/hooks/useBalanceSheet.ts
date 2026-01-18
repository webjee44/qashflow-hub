import { useMemo } from 'react';
import { useInvestments } from './useInvestments';
import { useFinancings } from './useFinancings';
import { useStocks } from './useStocks';
import { useProfitLoss } from './useProfitLoss';
import { useBPSettings } from './useBPSettings';
import { addMonths, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';

export interface BalanceSheetRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total';
  values: number[];
  indent?: number;
}

export interface BalanceSheetData {
  years: { label: string; endDate: Date }[];
  rows: BalanceSheetRow[];
  totals: {
    fixedAssets: number[];
    currentAssets: number[];
    totalAssets: number[];
    equity: number[];
    financialDebts: number[];
    operatingDebts: number[];
    totalLiabilities: number[];
  };
  bfr: number[];
  workingCapital: number[];
  cash: number[];
}

export function useBalanceSheet() {
  const { investments, isLoading: investmentsLoading, getDepreciationForMonth } = useInvestments();
  const { financings, getTotalOutstandingLoans, isLoading: financingsLoading } = useFinancings();
  const { stocks, getStockValueAtEnd, isLoading: stocksLoading } = useStocks();
  const { data: plData, isLoading: plLoading } = useProfitLoss();
  const { settings, isLoading: settingsLoading, getFiscalYears } = useBPSettings();

  const isLoading = investmentsLoading || financingsLoading || stocksLoading || plLoading || settingsLoading;

  const data = useMemo<BalanceSheetData>(() => {
    const fiscalYears = getFiscalYears();
    const years = fiscalYears.map((fy, i) => ({
      label: `Année ${i + 1}`,
      endDate: fy.end,
    }));

    const customerDelay = settings.customer_payment_delay || 30;
    const supplierDelay = settings.supplier_payment_delay || 30;

    const rows: BalanceSheetRow[] = [];

    // ═══════════════════════════════════════════════════════════════
    // ACTIF (ASSETS)
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'ACTIF', type: 'header', values: [] });

    // Actif Immobilisé (Fixed Assets)
    rows.push({ label: 'Actif immobilisé', type: 'header', values: [], indent: 1 });

    // Immobilisations brutes - amortissements cumulés
    const fixedAssetsValues = years.map((year, yearIndex) => {
      // Get all investments purchased before or during this year
      const grossAssets = investments
        .filter(inv => new Date(inv.purchase_date) <= year.endDate)
        .reduce((sum, inv) => sum + Number(inv.purchase_amount), 0);

      // Calculate accumulated depreciation up to end of this fiscal year
      let accumulatedDepreciation = 0;
      const startDate = new Date(settings.bp_start_date);
      let currentMonth = startOfMonth(startDate);
      
      while (currentMonth <= year.endDate) {
        accumulatedDepreciation += getDepreciationForMonth(currentMonth);
        currentMonth = addMonths(currentMonth, 1);
      }

      return grossAssets - accumulatedDepreciation;
    });

    rows.push({ label: 'Immobilisations nettes', type: 'item', values: fixedAssetsValues, indent: 2 });
    rows.push({ label: 'Total Actif Immobilisé', type: 'subtotal', values: fixedAssetsValues });

    // Actif Circulant (Current Assets)
    rows.push({ label: 'Actif circulant', type: 'header', values: [], indent: 1 });

    // Stocks (only if show_stocks is enabled)
    const showStocks = settings.show_stocks !== false;
    const stockValues = showStocks 
      ? years.map((_, i) => getStockValueAtEnd(i + 1))
      : years.map(() => 0);
    
    if (showStocks) {
      rows.push({ label: 'Stocks', type: 'item', values: stockValues, indent: 2 });
    }

    // Créances clients (based on revenue and payment delay)
    const receivablesValues = years.map((_, yearIndex) => {
      const yearRevenue = plData.totals.revenue[yearIndex] || 0;
      // Average receivables = (Revenue * Days) / 365
      return (yearRevenue * customerDelay) / 365;
    });
    rows.push({ label: 'Créances clients', type: 'item', values: receivablesValues, indent: 2 });

    // Trésorerie (we'll calculate this from cash flow)
    const cashValues = years.map((_, yearIndex) => {
      // Start with initial cash and add cumulative net results
      let cash = Number(settings.initial_cash) || 0;
      for (let i = 0; i <= yearIndex; i++) {
        cash += plData.totals.netResult[i] || 0;
        // Adjust for working capital changes (simplified)
      }
      return Math.max(0, cash);
    });
    rows.push({ label: 'Trésorerie', type: 'item', values: cashValues, indent: 2 });

    const currentAssetsValues = years.map((_, i) => 
      stockValues[i] + receivablesValues[i] + cashValues[i]
    );
    rows.push({ label: 'Total Actif Circulant', type: 'subtotal', values: currentAssetsValues });

    const totalAssetsValues = years.map((_, i) => fixedAssetsValues[i] + currentAssetsValues[i]);
    rows.push({ label: 'TOTAL ACTIF', type: 'total', values: totalAssetsValues });

    // ═══════════════════════════════════════════════════════════════
    // PASSIF (LIABILITIES)
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'PASSIF', type: 'header', values: [] });

    // Capitaux Propres (Equity)
    rows.push({ label: 'Capitaux propres', type: 'header', values: [], indent: 1 });

    const capitalValues = years.map(() => Number(settings.initial_cash) || 0);
    rows.push({ label: 'Capital social', type: 'item', values: capitalValues, indent: 2 });

    // Cumulative retained earnings
    const retainedEarningsValues = years.map((_, yearIndex) => {
      let cumulative = 0;
      for (let i = 0; i < yearIndex; i++) {
        cumulative += plData.totals.netResult[i] || 0;
      }
      return cumulative;
    });
    rows.push({ label: 'Report à nouveau', type: 'item', values: retainedEarningsValues, indent: 2 });

    // Current year result
    const currentYearResultValues = years.map((_, i) => plData.totals.netResult[i] || 0);
    rows.push({ label: 'Résultat de l\'exercice', type: 'item', values: currentYearResultValues, indent: 2 });

    const equityValues = years.map((_, i) => 
      capitalValues[i] + retainedEarningsValues[i] + currentYearResultValues[i]
    );
    rows.push({ label: 'Total Capitaux Propres', type: 'subtotal', values: equityValues });

    // Dettes Financières (Financial Debts)
    rows.push({ label: 'Dettes financières', type: 'header', values: [], indent: 1 });

    // Bank loans
    const bankLoansValues = years.map(year => {
      return financings
        .filter(f => f.financing_type === 'loan')
        .reduce((sum, f) => {
          const endDate = f.end_date ? new Date(f.end_date) : addMonths(new Date(f.start_date), f.duration_months);
          if (year.endDate > endDate) return sum;
          return sum + getTotalOutstandingLoans(year.endDate);
        }, 0) / Math.max(1, financings.filter(f => f.financing_type === 'loan').length);
    });
    rows.push({ label: 'Emprunts bancaires', type: 'item', values: bankLoansValues, indent: 2 });

    // Current accounts (comptes courants associés)
    const currentAccountValues = years.map(year => {
      return financings
        .filter(f => f.financing_type === 'current_account')
        .filter(f => {
          const startDate = new Date(f.start_date);
          const endDate = f.end_date ? new Date(f.end_date) : null;
          return startDate <= year.endDate && (!endDate || endDate >= year.endDate);
        })
        .reduce((sum, f) => sum + Number(f.amount), 0);
    });
    if (currentAccountValues.some(v => v > 0)) {
      rows.push({ label: 'Comptes courants d\'associés', type: 'item', values: currentAccountValues, indent: 2 });
    }

    const financialDebtsValues = years.map((_, i) => 
      bankLoansValues[i] + currentAccountValues[i]
    );
    rows.push({ label: 'Total Dettes Financières', type: 'subtotal', values: financialDebtsValues });

    // Dettes d'exploitation (Operating Debts)
    rows.push({ label: 'Dettes d\'exploitation', type: 'header', values: [], indent: 1 });

    // Dettes fournisseurs (based on expenses and payment delay)
    const payablesValues = years.map((_, yearIndex) => {
      const yearExpenses = (plData.totals.fixedExpenses[yearIndex] || 0) + 
                          (plData.totals.variableExpenses[yearIndex] || 0);
      return (yearExpenses * supplierDelay) / 365;
    });
    rows.push({ label: 'Dettes fournisseurs', type: 'item', values: payablesValues, indent: 2 });

    // Dettes fiscales et sociales (simplified: tax + social charges to pay)
    const taxDebtsValues = years.map((_, yearIndex) => {
      const tax = plData.totals.corporateTax[yearIndex] || 0;
      const socialCharges = (plData.totals.personnelCosts[yearIndex] || 0) * 0.1; // Estimate 10% as unpaid
      return tax + socialCharges;
    });
    rows.push({ label: 'Dettes fiscales et sociales', type: 'item', values: taxDebtsValues, indent: 2 });

    const operatingDebtsValues = years.map((_, i) => payablesValues[i] + taxDebtsValues[i]);
    rows.push({ label: 'Total Dettes d\'Exploitation', type: 'subtotal', values: operatingDebtsValues });

    const totalLiabilitiesValues = years.map((_, i) => 
      equityValues[i] + financialDebtsValues[i] + operatingDebtsValues[i]
    );
    rows.push({ label: 'TOTAL PASSIF', type: 'total', values: totalLiabilitiesValues });

    // ═══════════════════════════════════════════════════════════════
    // RATIOS
    // ═══════════════════════════════════════════════════════════════
    
    // BFR = Stocks + Créances clients - Dettes fournisseurs
    const bfrValues = years.map((_, i) => 
      stockValues[i] + receivablesValues[i] - payablesValues[i]
    );

    // Fonds de roulement = Capitaux propres + Dettes financières - Actif immobilisé
    const workingCapitalValues = years.map((_, i) => 
      equityValues[i] + financialDebtsValues[i] - fixedAssetsValues[i]
    );

    return {
      years,
      rows,
      totals: {
        fixedAssets: fixedAssetsValues,
        currentAssets: currentAssetsValues,
        totalAssets: totalAssetsValues,
        equity: equityValues,
        financialDebts: financialDebtsValues,
        operatingDebts: operatingDebtsValues,
        totalLiabilities: totalLiabilitiesValues,
      },
      bfr: bfrValues,
      workingCapital: workingCapitalValues,
      cash: cashValues,
    };
  }, [investments, financings, stocks, plData, settings, getFiscalYears, getDepreciationForMonth, getTotalOutstandingLoans, getStockValueAtEnd]);

  // Helper: check if balance sheet is balanced
  const isBalanced = (): boolean => {
    return data.totals.totalAssets.every((asset, i) => 
      Math.abs(asset - data.totals.totalLiabilities[i]) < 1 // Allow for rounding
    );
  };

  // Helper: get debt-to-equity ratio
  const getDebtToEquityRatio = (yearIndex: number): number => {
    const equity = data.totals.equity[yearIndex];
    const debt = data.totals.financialDebts[yearIndex];
    return equity > 0 ? debt / equity : 0;
  };

  // Helper: get solvency ratio (equity / total assets)
  const getSolvencyRatio = (yearIndex: number): number => {
    const equity = data.totals.equity[yearIndex];
    const assets = data.totals.totalAssets[yearIndex];
    return assets > 0 ? equity / assets : 0;
  };

  return {
    data,
    isLoading,
    isBalanced,
    getDebtToEquityRatio,
    getSolvencyRatio,
  };
}
