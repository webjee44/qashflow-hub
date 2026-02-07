import { useMemo } from 'react';
import { useInvestments } from './useInvestments';
import { useFinancings } from './useFinancings';
import { useStocks } from './useStocks';
import { useProfitLoss } from './useProfitLoss';
import { useBPSettings } from './useBPSettings';
import { addMonths, startOfMonth } from 'date-fns';

export interface BalanceSheetRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total';
  values: number[];
  indent?: number;
  /** When true, negative values are highlighted as warnings (e.g. negative cash) */
  alertNegative?: boolean;
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
    const showStocks = settings.show_stocks !== false;
    const showFinancing = settings.show_financing !== false;

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: All ASSET items EXCEPT cash
    // ═══════════════════════════════════════════════════════════════

    // Immobilisations nettes (Fixed Assets)
    const fixedAssetsValues = years.map((year) => {
      const grossAssets = investments
        .filter(inv => new Date(inv.purchase_date) <= year.endDate)
        .reduce((sum, inv) => sum + Number(inv.purchase_amount), 0);

      let accumulatedDepreciation = 0;
      const startDate = new Date(settings.bp_start_date);
      let currentMonth = startOfMonth(startDate);
      while (currentMonth <= year.endDate) {
        accumulatedDepreciation += getDepreciationForMonth(currentMonth);
        currentMonth = addMonths(currentMonth, 1);
      }
      return grossAssets - accumulatedDepreciation;
    });

    // Stocks
    const stockValues = showStocks
      ? years.map((_, i) => getStockValueAtEnd(i + 1))
      : years.map(() => 0);

    // Créances clients
    const receivablesValues = years.map((_, yearIndex) => {
      const yearRevenue = plData.totals.revenue[yearIndex] || 0;
      return (yearRevenue * customerDelay) / 365;
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: All LIABILITY items
    // ═══════════════════════════════════════════════════════════════

    // --- Capitaux propres ---
    const capitalValues = years.map(() => Number(settings.initial_cash) || 0);

    const retainedEarningsValues = years.map((_, yearIndex) => {
      let cumulative = 0;
      for (let i = 0; i < yearIndex; i++) {
        cumulative += plData.totals.netResult[i] || 0;
      }
      return cumulative;
    });

    const currentYearResultValues = years.map((_, i) => plData.totals.netResult[i] || 0);

    // Subventions d'investissement (investment grants, non-operating)
    const investmentGrantValues = years.map((year) => {
      return financings
        .filter(f => f.financing_type === 'grant' && !f.is_operating_grant)
        .filter(f => new Date(f.start_date) <= year.endDate)
        .reduce((sum, f) => sum + Number(f.amount), 0);
    });

    const equityValues = years.map((_, i) =>
      capitalValues[i] + retainedEarningsValues[i] + currentYearResultValues[i] + investmentGrantValues[i]
    );

    // --- Dettes financières ---
    // FIX A: Single call per year instead of buggy reduce/divide
    const bankLoansValues = years.map(year => getTotalOutstandingLoans(year.endDate));

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

    const financialDebtsValues = years.map((_, i) =>
      bankLoansValues[i] + currentAccountValues[i]
    );

    // --- Dettes d'exploitation ---
    const payablesValues = years.map((_, yearIndex) => {
      const yearExpenses = (plData.totals.fixedExpenses[yearIndex] || 0) +
                          (plData.totals.variableExpenses[yearIndex] || 0);
      return (yearExpenses * supplierDelay) / 365;
    });

    const taxDebtsValues = years.map((_, yearIndex) => {
      const tax = plData.totals.corporateTax[yearIndex] || 0;
      const socialCharges = (plData.totals.personnelCosts[yearIndex] || 0) * 0.1;
      return tax + socialCharges;
    });

    const operatingDebtsValues = years.map((_, i) => payablesValues[i] + taxDebtsValues[i]);

    const totalLiabilitiesValues = years.map((_, i) =>
      equityValues[i] + financialDebtsValues[i] + operatingDebtsValues[i]
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Derive CASH as balancing item
    // Cash = Total Passif − (Immobilisations nettes + Stocks + Créances)
    // This guarantees Actif = Passif by construction
    // ═══════════════════════════════════════════════════════════════
    const cashValues = years.map((_, i) =>
      totalLiabilitiesValues[i] - (fixedAssetsValues[i] + stockValues[i] + receivablesValues[i])
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Build display rows
    // ═══════════════════════════════════════════════════════════════
    const rows: BalanceSheetRow[] = [];

    // --- ACTIF ---
    rows.push({ label: 'ACTIF', type: 'header', values: [] });
    rows.push({ label: 'Actif immobilisé', type: 'header', values: [], indent: 1 });
    rows.push({ label: 'Immobilisations nettes', type: 'item', values: fixedAssetsValues, indent: 2 });
    rows.push({ label: 'Total Actif Immobilisé', type: 'subtotal', values: fixedAssetsValues });

    rows.push({ label: 'Actif circulant', type: 'header', values: [], indent: 1 });
    if (showStocks) {
      rows.push({ label: 'Stocks', type: 'item', values: stockValues, indent: 2 });
    }
    rows.push({ label: 'Créances clients', type: 'item', values: receivablesValues, indent: 2 });
    rows.push({ label: 'Trésorerie', type: 'item', values: cashValues, indent: 2, alertNegative: true });

    const currentAssetsValues = years.map((_, i) =>
      stockValues[i] + receivablesValues[i] + cashValues[i]
    );
    rows.push({ label: 'Total Actif Circulant', type: 'subtotal', values: currentAssetsValues });

    // Total Assets = Total Liabilities (by construction)
    const totalAssetsValues = [...totalLiabilitiesValues];
    rows.push({ label: 'TOTAL ACTIF', type: 'total', values: totalAssetsValues });

    // --- PASSIF ---
    rows.push({ label: 'PASSIF', type: 'header', values: [] });
    rows.push({ label: 'Capitaux propres', type: 'header', values: [], indent: 1 });
    rows.push({ label: 'Capital social', type: 'item', values: capitalValues, indent: 2 });
    rows.push({ label: 'Report à nouveau', type: 'item', values: retainedEarningsValues, indent: 2 });
    rows.push({ label: 'Résultat de l\'exercice', type: 'item', values: currentYearResultValues, indent: 2 });
    if (investmentGrantValues.some(v => v > 0)) {
      rows.push({ label: 'Subventions d\'investissement', type: 'item', values: investmentGrantValues, indent: 2 });
    }
    rows.push({ label: 'Total Capitaux Propres', type: 'subtotal', values: equityValues });

    if (showFinancing) {
      rows.push({ label: 'Dettes financières', type: 'header', values: [], indent: 1 });
      rows.push({ label: 'Emprunts bancaires', type: 'item', values: bankLoansValues, indent: 2 });
      if (currentAccountValues.some(v => v > 0)) {
        rows.push({ label: 'Comptes courants d\'associés', type: 'item', values: currentAccountValues, indent: 2 });
      }
      rows.push({ label: 'Total Dettes Financières', type: 'subtotal', values: financialDebtsValues });
    }

    rows.push({ label: 'Dettes d\'exploitation', type: 'header', values: [], indent: 1 });
    rows.push({ label: 'Dettes fournisseurs', type: 'item', values: payablesValues, indent: 2 });
    rows.push({ label: 'Dettes fiscales et sociales', type: 'item', values: taxDebtsValues, indent: 2 });
    rows.push({ label: 'Total Dettes d\'Exploitation', type: 'subtotal', values: operatingDebtsValues });

    rows.push({ label: 'TOTAL PASSIF', type: 'total', values: totalLiabilitiesValues });

    // ═══════════════════════════════════════════════════════════════
    // BFR & Working Capital (unchanged)
    // ═══════════════════════════════════════════════════════════════
    const bfrValues = years.map((_, i) =>
      stockValues[i] + receivablesValues[i] - payablesValues[i]
    );
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

  const isBalanced = (): boolean => {
    return data.totals.totalAssets.every((asset, i) =>
      Math.abs(asset - data.totals.totalLiabilities[i]) < 1
    );
  };

  const getDebtToEquityRatio = (yearIndex: number): number => {
    const equity = data.totals.equity[yearIndex];
    const debt = data.totals.financialDebts[yearIndex];
    return equity > 0 ? debt / equity : 0;
  };

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
