// computeBalanceSheet — pure balance sheet computation (parity with src/hooks/useBalanceSheet)
import { addMonths, startOfMonth, parseISO, differenceInMonths, isAfter } from 'date-fns';
import { calculateMonthlyDepreciation, getLoanScheduleEntry } from '@/lib/french-rates';
import type { BPModelInput } from './types';
import type { PLData } from '../hooks/useProfitLoss';
import type { BalanceSheetData, BalanceSheetRow } from '@/hooks/useBalanceSheet';

function makeGetDepreciationForMonth(investments: any[]) {
  return (month: Date): number => {
    const monthStart = startOfMonth(month);
    return investments.reduce((total, inv) => {
      const purchaseDate = startOfMonth(parseISO(inv.purchase_date));
      const endDate = addMonths(purchaseDate, inv.depreciation_years * 12);
      if (monthStart < purchaseDate || monthStart >= endDate) return total;
      const monthlyDep = calculateMonthlyDepreciation(
        Number(inv.purchase_amount),
        inv.depreciation_years,
        inv.depreciation_method as 'linear' | 'degressive'
      );
      return total + monthlyDep;
    }, 0);
  };
}

function getTotalOutstandingLoans(financings: any[], atDate: Date): number {
  return financings
    .filter(f => f.financing_type === 'loan')
    .reduce((sum, f) => {
      const startDate = parseISO(f.start_date);
      if (isAfter(startDate, atDate)) return sum + Number(f.amount);
      const monthIdx = differenceInMonths(startOfMonth(atDate), startOfMonth(startDate));
      if (monthIdx >= f.duration_months) return sum;
      const entry = getLoanScheduleEntry(
        Number(f.amount), Number(f.interest_rate), f.duration_months, monthIdx
      );
      return sum + entry.remaining;
    }, 0);
}

export function computeBalanceSheet(input: BPModelInput, plData: PLData): BalanceSheetData {
  const { settings, investments, financings, stocks } = input;
  const getDepreciationForMonth = makeGetDepreciationForMonth(investments);

  const years = plData.years.map((y, i) => ({ label: `Année ${i + 1}`, endDate: y.end }));

  const customerDelay = settings.customer_payment_delay || 30;
  const supplierDelay = settings.supplier_payment_delay || 30;
  const showStocks = settings.show_stocks !== false;
  const showFinancing = settings.show_financing !== false;

  const getStockValueAtEnd = (fiscalYear: number): number =>
    stocks.filter(s => s.fiscal_year === fiscalYear).reduce((sum, s) => sum + Number(s.final_stock), 0);

  const fixedAssetsValues = years.map(year => {
    const grossAssets = investments
      .filter(inv => new Date(inv.purchase_date) <= year.endDate)
      .reduce((sum, inv) => sum + Number(inv.purchase_amount), 0);
    let accumulatedDepreciation = 0;
    const startDate = settings.bp_start_date ? new Date(settings.bp_start_date) : new Date();
    let currentMonth = startOfMonth(startDate);
    while (currentMonth <= year.endDate) {
      accumulatedDepreciation += getDepreciationForMonth(currentMonth);
      currentMonth = addMonths(currentMonth, 1);
    }
    return grossAssets - accumulatedDepreciation;
  });

  const stockValues = showStocks ? years.map((_, i) => getStockValueAtEnd(i + 1)) : years.map(() => 0);

  const receivablesValues = years.map((_, yearIndex) => {
    const yearRevenue = plData.totals.revenue[yearIndex] || 0;
    return (yearRevenue * customerDelay) / 365;
  });

  const capitalValues = years.map(() => Number(settings.initial_cash) || 0);
  const retainedEarningsValues = years.map((_, yearIndex) => {
    let cumulative = 0;
    for (let i = 0; i < yearIndex; i++) cumulative += plData.totals.netResult[i] || 0;
    return cumulative;
  });
  const currentYearResultValues = years.map((_, i) => plData.totals.netResult[i] || 0);

  const investmentGrantValues = years.map(year =>
    financings
      .filter(f => f.financing_type === 'grant' && !f.is_operating_grant)
      .filter(f => new Date(f.start_date) <= year.endDate)
      .reduce((sum, f) => sum + Number(f.amount), 0)
  );

  const equityValues = years.map((_, i) =>
    capitalValues[i] + retainedEarningsValues[i] + currentYearResultValues[i] + investmentGrantValues[i]
  );

  const bankLoansValues = years.map(year => getTotalOutstandingLoans(financings, year.endDate));

  const currentAccountValues = years.map(year =>
    financings
      .filter(f => f.financing_type === 'current_account')
      .filter(f => {
        const startDate = new Date(f.start_date);
        const endDate = f.end_date ? new Date(f.end_date) : null;
        return startDate <= year.endDate && (!endDate || endDate >= year.endDate);
      })
      .reduce((sum, f) => sum + Number(f.amount), 0)
  );

  const financialDebtsValues = years.map((_, i) => bankLoansValues[i] + currentAccountValues[i]);

  const payablesValues = years.map((_, yearIndex) => {
    const yearExpenses = (plData.totals.fixedExpenses[yearIndex] || 0) + (plData.totals.variableExpenses[yearIndex] || 0);
    return (yearExpenses * supplierDelay) / 365;
  });

  const taxDebtsValues = years.map((_, yearIndex) => {
    const tax = plData.totals.corporateTax[yearIndex] || 0;
    const socialCharges = (plData.totals.personnelCosts[yearIndex] || 0) * 0.1;
    return tax + socialCharges;
  });

  const operatingDebtsValues = years.map((_, i) => payablesValues[i] + taxDebtsValues[i]);
  const totalLiabilitiesValues = years.map((_, i) => equityValues[i] + financialDebtsValues[i] + operatingDebtsValues[i]);
  const cashValues = years.map((_, i) =>
    totalLiabilitiesValues[i] - (fixedAssetsValues[i] + stockValues[i] + receivablesValues[i])
  );

  const rows: BalanceSheetRow[] = [];
  rows.push({ label: 'ACTIF', type: 'header', values: [] });
  rows.push({ label: 'Actif immobilisé', type: 'header', values: [], indent: 1 });
  rows.push({ label: 'Immobilisations nettes', type: 'item', values: fixedAssetsValues, indent: 2 });
  rows.push({ label: 'Total Actif Immobilisé', type: 'subtotal', values: fixedAssetsValues });
  rows.push({ label: 'Actif circulant', type: 'header', values: [], indent: 1 });
  if (showStocks) rows.push({ label: 'Stocks', type: 'item', values: stockValues, indent: 2 });
  rows.push({ label: 'Créances clients', type: 'item', values: receivablesValues, indent: 2 });
  rows.push({ label: 'Trésorerie', type: 'item', values: cashValues, indent: 2, alertNegative: true });
  const currentAssetsValues = years.map((_, i) => stockValues[i] + receivablesValues[i] + cashValues[i]);
  rows.push({ label: 'Total Actif Circulant', type: 'subtotal', values: currentAssetsValues });
  const totalAssetsValues = [...totalLiabilitiesValues];
  rows.push({ label: 'TOTAL ACTIF', type: 'total', values: totalAssetsValues });

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

  const bfrValues = years.map((_, i) => stockValues[i] + receivablesValues[i] - payablesValues[i]);
  const workingCapitalValues = years.map((_, i) => equityValues[i] + financialDebtsValues[i] - fixedAssetsValues[i]);

  return {
    years, rows,
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
}
