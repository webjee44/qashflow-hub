import { useMemo } from 'react';
import { useRevenueStreams } from './useRevenueStreams';
import { useFixedExpenses } from './useFixedExpenses';
import { useVariableExpenses } from './useVariableExpenses';
import { usePersonnel } from './usePersonnel';
import { useDirectors } from './useDirectors';
import { useInvestments } from './useInvestments';
import { useFinancings } from './useFinancings';
import { useBPSettings } from './useBPSettings';
import { startOfMonth, addMonths, isWithinInterval, startOfDay } from 'date-fns';
import { calculateIS, TVA_RATES_FR } from '@/lib/french-rates';

export interface PLRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total' | 'sig';
  values: number[]; // Now represents years instead of months
  isExpense?: boolean;
  indent?: number;
}

export interface FiscalYear {
  start: Date;
  end: Date;
  label: string;
  months: Date[];
}

export interface PLData {
  years: FiscalYear[];
  rows: PLRow[];
  totals: {
    revenue: number[];
    fixedExpenses: number[];
    variableExpenses: number[];
    personnelCosts: number[];
    directorsCosts: number[];
    depreciation: number[];
    leaseExpenses: number[];
    ebitda: number[];
    operatingResult: number[];
    financialResult: number[];
    netResultBeforeTax: number[];
    corporateTax: number[];
    netResult: number[];
  };
  grandTotal: {
    revenue: number;
    fixedExpenses: number;
    variableExpenses: number;
    personnelCosts: number;
    directorsCosts: number;
    depreciation: number;
    leaseExpenses: number;
    ebitda: number;
    operatingResult: number;
    financialResult: number;
    netResultBeforeTax: number;
    corporateTax: number;
    netResult: number;
    grossMarginPercent: number;
    ebitdaMarginPercent: number;
  };
  tva: {
    collected: number[];
    deductible: number[];
    balance: number[];
  };
}

export function useProfitLoss() {
  const { streams, getForecast, isLoading: revenueLoading } = useRevenueStreams();
  const { expenses, getTotalForMonth: getExpensesTotal, isLoading: expensesLoading, expenses: allExpenses } = useFixedExpenses();
  const { expenses: variableExpenses, calculateVariableExpenseForMonth, isLoading: variableExpensesLoading } = useVariableExpenses();
  const { personnel, getBreakdownForMonth, isLoading: personnelLoading } = usePersonnel();
  const { directors, getBreakdownForMonth: getDirectorsBreakdown, isLoading: directorsLoading } = useDirectors();
  const { getDepreciationForMonth, isLoading: investmentsLoading } = useInvestments();
  const { getMonthlyLeasePayments, getMonthlyInterestExpense, isLoading: financingsLoading } = useFinancings();
  const { settings, getFiscalYears, isLoading: settingsLoading } = useBPSettings();

  const isLoading = revenueLoading || expensesLoading || variableExpensesLoading || personnelLoading || directorsLoading || investmentsLoading || financingsLoading || settingsLoading;

  const data = useMemo<PLData>(() => {
    // Get fiscal years from settings
    const fiscalYearsBase = getFiscalYears();
    
    // Generate months for each fiscal year
    const years: FiscalYear[] = fiscalYearsBase.map(fy => {
      const months: Date[] = [];
      let currentMonth = startOfMonth(fy.start);
      while (currentMonth <= fy.end) {
        months.push(currentMonth);
        currentMonth = addMonths(currentMonth, 1);
      }
      return { ...fy, months };
    });

    // Helper to calculate monthly values and sum by year
    const calculateYearlyValues = (getMonthValue: (month: Date) => number): number[] => {
      return years.map(year => 
        year.months.reduce((sum, month) => sum + getMonthValue(month), 0)
      );
    };

    const rows: PLRow[] = [];

    // ═══════════════════════════════════════════════════════════════
    // PRODUITS D'EXPLOITATION
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'PRODUITS D\'EXPLOITATION', type: 'header', values: [] });
    
    // Chiffre d'affaires par flux
    streams.forEach(stream => {
      const values = calculateYearlyValues(month => getForecast(stream.id, month));
      rows.push({
        label: stream.name,
        type: 'item',
        values,
        indent: 1,
      });
    });

    const revenueValues = calculateYearlyValues(month => 
      streams.reduce((sum, stream) => sum + getForecast(stream.id, month), 0)
    );
    rows.push({ label: 'Chiffre d\'affaires', type: 'subtotal', values: revenueValues });

    // ═══════════════════════════════════════════════════════════════
    // CHARGES D'EXPLOITATION
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'CHARGES D\'EXPLOITATION', type: 'header', values: [], isExpense: true });

    // Charges variables (coûts proportionnels au CA)
    const variableExpenseValues = calculateYearlyValues(month => {
      const revenueByStream = new Map<string | null, { amount: number; units: number }>();
      streams.forEach(stream => {
        const amount = getForecast(stream.id, month);
        revenueByStream.set(stream.id, { amount, units: 1 });
      });
      
      return variableExpenses.reduce((total, expense) => {
        return total + calculateVariableExpenseForMonth(expense, month, revenueByStream);
      }, 0);
    });

    if (variableExpenses.length > 0) {
      rows.push({ label: 'Charges variables', type: 'header', values: [], isExpense: true, indent: 1 });
      
      variableExpenses.forEach(expense => {
        const values = calculateYearlyValues(month => {
          const revenueByStream = new Map<string | null, { amount: number; units: number }>();
          streams.forEach(stream => {
            const amount = getForecast(stream.id, month);
            revenueByStream.set(stream.id, { amount, units: 1 });
          });
          return calculateVariableExpenseForMonth(expense, month, revenueByStream);
        });
        rows.push({
          label: expense.name,
          type: 'item',
          values,
          isExpense: true,
          indent: 2,
        });
      });
      
      rows.push({ label: 'Total charges variables', type: 'subtotal', values: variableExpenseValues, isExpense: true });
    }

    // Achats et charges externes (fixes)
    rows.push({ label: 'Achats et charges externes', type: 'header', values: [], isExpense: true, indent: 1 });
    
    expenses.forEach(expense => {
      const values = calculateYearlyValues(month => {
        const startDate = startOfMonth(new Date(expense.start_date));
        const endDate = expense.end_date ? startOfMonth(new Date(expense.end_date)) : null;
        const monthStart = startOfMonth(month);
        const isActive = monthStart >= startDate && (!endDate || monthStart <= endDate);
        return isActive ? Number(expense.monthly_amount) : 0;
      });
      rows.push({
        label: expense.name,
        type: 'item',
        values,
        isExpense: true,
        indent: 2,
      });
    });

    const fixedExpenseValues = calculateYearlyValues(month => getExpensesTotal(month));
    rows.push({ label: 'Total charges fixes', type: 'subtotal', values: fixedExpenseValues, isExpense: true });

    // Charges de personnel
    rows.push({ label: 'Charges de personnel', type: 'header', values: [], isExpense: true, indent: 1 });
    
    const grossSalaryValues = calculateYearlyValues(month => getBreakdownForMonth(month).grossSalaries);
    rows.push({ label: 'Salaires bruts', type: 'item', values: grossSalaryValues, isExpense: true, indent: 2 });
    
    const chargesValues = calculateYearlyValues(month => getBreakdownForMonth(month).employerCharges);
    rows.push({ label: 'Charges sociales patronales', type: 'item', values: chargesValues, isExpense: true, indent: 2 });

    const personnelValues = calculateYearlyValues(month => getBreakdownForMonth(month).total);
    rows.push({ label: 'Total personnel salarié', type: 'subtotal', values: personnelValues, isExpense: true });

    // Rémunération des dirigeants
    const directorTotalValues = calculateYearlyValues(month => getDirectorsBreakdown(month).total);

    if (directors.length > 0) {
      rows.push({ label: 'Rémunération dirigeants', type: 'header', values: [], isExpense: true, indent: 1 });
      const directorRemunerationValues = calculateYearlyValues(month => getDirectorsBreakdown(month).remuneration);
      const directorChargesValues = calculateYearlyValues(month => getDirectorsBreakdown(month).charges);
      rows.push({ label: 'Rémunération nette', type: 'item', values: directorRemunerationValues, isExpense: true, indent: 2 });
      rows.push({ label: 'Charges sociales', type: 'item', values: directorChargesValues, isExpense: true, indent: 2 });
      rows.push({ label: 'Total dirigeants', type: 'subtotal', values: directorTotalValues, isExpense: true });
    }

    // Dotations aux amortissements
    const depreciationValues = calculateYearlyValues(month => getDepreciationForMonth(month));
    if (depreciationValues.some(v => v > 0)) {
      rows.push({ label: 'Dotations aux amortissements', type: 'item', values: depreciationValues, isExpense: true });
    }

    // Loyers de crédit-bail (leasing)
    const leaseExpenseValues = calculateYearlyValues(month => getMonthlyLeasePayments(month));
    if (leaseExpenseValues.some(v => v > 0)) {
      rows.push({ label: 'Loyers de crédit-bail', type: 'item', values: leaseExpenseValues, isExpense: true });
    }

    // Total charges d'exploitation
    const totalExpenseValues = years.map((_, i) => 
      variableExpenseValues[i] + fixedExpenseValues[i] + personnelValues[i] + directorTotalValues[i] + depreciationValues[i] + leaseExpenseValues[i]
    );
    rows.push({ label: 'Total charges d\'exploitation', type: 'subtotal', values: totalExpenseValues, isExpense: true });

    // ═══════════════════════════════════════════════════════════════
    // SOLDES INTERMÉDIAIRES DE GESTION (SIG)
    // ═══════════════════════════════════════════════════════════════

    // Marge brute = CA - Charges variables
    const grossMarginValues = years.map((_, i) => revenueValues[i] - variableExpenseValues[i]);
    rows.push({ label: 'MARGE BRUTE', type: 'sig', values: grossMarginValues });

    // Valeur Ajoutée = Marge brute - Charges fixes
    const vaValues = years.map((_, i) => grossMarginValues[i] - fixedExpenseValues[i]);
    rows.push({ label: 'VALEUR AJOUTÉE', type: 'sig', values: vaValues });

    // EBE = VA - Charges de personnel - Rémunération dirigeants - Loyers crédit-bail
    const ebeValues = years.map((_, i) => 
      vaValues[i] - personnelValues[i] - directorTotalValues[i] - leaseExpenseValues[i]
    );
    rows.push({ label: 'EXCÉDENT BRUT D\'EXPLOITATION (EBE)', type: 'sig', values: ebeValues });

    // Résultat d'exploitation = EBE - Amortissements
    const operatingResultValues = years.map((_, i) => ebeValues[i] - depreciationValues[i]);
    rows.push({ label: 'RÉSULTAT D\'EXPLOITATION', type: 'sig', values: operatingResultValues });

    // Résultat financier = -intérêts d'emprunts
    const financialResultValues = calculateYearlyValues(month => -getMonthlyInterestExpense(month));
    rows.push({ label: 'Résultat financier', type: 'item', values: financialResultValues, isExpense: financialResultValues.some(v => v < 0) });

    // RCAI = Résultat d'exploitation + Résultat financier
    const rcaiValues = years.map((_, i) => operatingResultValues[i] + financialResultValues[i]);
    rows.push({ label: 'RÉSULTAT COURANT AVANT IMPÔTS (RCAI)', type: 'sig', values: rcaiValues });

    // Impôt sur les sociétés (par année)
    const isPME = settings.is_pme !== false;
    const isValues = years.map((_, i) => {
      const yearResult = rcaiValues[i];
      return calculateIS(Math.max(0, yearResult), isPME);
    });
    rows.push({ label: 'Impôt sur les sociétés', type: 'item', values: isValues, isExpense: true });

    // Résultat Net = RCAI - IS
    const netResultValues = years.map((_, i) => rcaiValues[i] - isValues[i]);
    rows.push({ label: 'RÉSULTAT NET', type: 'total', values: netResultValues });

    // ═══════════════════════════════════════════════════════════════
    // TVA (par année)
    // ═══════════════════════════════════════════════════════════════
    const tvaCollectedValues = calculateYearlyValues(month => {
      return streams.reduce((sum, stream) => {
        const revenue = getForecast(stream.id, month);
        const vatRate = (stream as any).vat_rate ?? TVA_RATES_FR.standard;
        return sum + (revenue * vatRate);
      }, 0);
    });

    const tvaDeductibleValues = calculateYearlyValues(month => {
      // Fixed expenses TVA
      const fixedTva = allExpenses.reduce((sum, expense) => {
        const startDate = startOfMonth(new Date(expense.start_date));
        const endDate = expense.end_date ? startOfMonth(new Date(expense.end_date)) : null;
        const monthStart = startOfMonth(month);
        const isActive = monthStart >= startDate && (!endDate || monthStart <= endDate);
        if (!isActive) return sum;
        
        const vatRate = (expense as any).vat_rate ?? TVA_RATES_FR.standard;
        const isDeductible = (expense as any).is_vat_deductible !== false;
        return sum + (isDeductible ? Number(expense.monthly_amount) * vatRate : 0);
      }, 0);

      // Variable expenses TVA
      const variableTva = variableExpenses.reduce((sum, expense) => {
        if (!expense.is_vat_deductible) return sum;
        
        const revenueByStream = new Map<string | null, { amount: number; units: number }>();
        streams.forEach(stream => {
          const amount = getForecast(stream.id, month);
          revenueByStream.set(stream.id, { amount, units: 1 });
        });
        
        const expenseAmount = calculateVariableExpenseForMonth(expense, month, revenueByStream);
        return sum + (expenseAmount * expense.vat_rate);
      }, 0);

      return fixedTva + variableTva;
    });

    const tvaBalanceValues = years.map((_, i) => tvaCollectedValues[i] - tvaDeductibleValues[i]);

    // Grand total (sum of all years)
    const sumAll = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const totalRevenue = sumAll(revenueValues);
    const totalVariableExpenses = sumAll(variableExpenseValues);
    
    const grandTotal = {
      revenue: totalRevenue,
      fixedExpenses: sumAll(fixedExpenseValues),
      variableExpenses: totalVariableExpenses,
      personnelCosts: sumAll(personnelValues),
      directorsCosts: sumAll(directorTotalValues),
      depreciation: sumAll(depreciationValues),
      leaseExpenses: sumAll(leaseExpenseValues),
      ebitda: sumAll(ebeValues),
      operatingResult: sumAll(operatingResultValues),
      financialResult: sumAll(financialResultValues),
      netResultBeforeTax: sumAll(rcaiValues),
      corporateTax: sumAll(isValues),
      netResult: sumAll(netResultValues),
      grossMarginPercent: totalRevenue > 0 ? ((totalRevenue - totalVariableExpenses) / totalRevenue) * 100 : 0,
      ebitdaMarginPercent: totalRevenue > 0 ? (sumAll(ebeValues) / totalRevenue) * 100 : 0,
    };

    return {
      years,
      rows,
      totals: {
        revenue: revenueValues,
        fixedExpenses: fixedExpenseValues,
        variableExpenses: variableExpenseValues,
        personnelCosts: personnelValues,
        directorsCosts: directorTotalValues,
        depreciation: depreciationValues,
        leaseExpenses: leaseExpenseValues,
        ebitda: ebeValues,
        operatingResult: operatingResultValues,
        financialResult: financialResultValues,
        netResultBeforeTax: rcaiValues,
        corporateTax: isValues,
        netResult: netResultValues,
      },
      grandTotal,
      tva: {
        collected: tvaCollectedValues,
        deductible: tvaDeductibleValues,
        balance: tvaBalanceValues,
      },
    };
  }, [streams, expenses, allExpenses, variableExpenses, personnel, directors, settings, getForecast, getExpensesTotal, calculateVariableExpenseForMonth, getBreakdownForMonth, getDirectorsBreakdown, getDepreciationForMonth, getMonthlyLeasePayments, getMonthlyInterestExpense, getFiscalYears]);

  // Helper: get break-even year
  const getBreakEvenYear = (): number | null => {
    let cumulative = 0;
    for (let i = 0; i < data.totals.netResult.length; i++) {
      cumulative += data.totals.netResult[i];
      if (cumulative > 0) return i + 1;
    }
    return null;
  };

  // Helper: get gross margin percentage
  const getGrossMargin = (): number => {
    return data.grandTotal.grossMarginPercent;
  };

  // Helper: get EBITDA margin
  const getEBITDAMargin = (): number => {
    return data.grandTotal.ebitdaMarginPercent;
  };

  return {
    data,
    isLoading,
    getBreakEvenYear,
    getGrossMargin,
    getEBITDAMargin,
  };
}