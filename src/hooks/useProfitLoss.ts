import { useMemo } from 'react';
import { useRevenueStreams } from './useRevenueStreams';
import { useFixedExpenses } from './useFixedExpenses';
import { useVariableExpenses } from './useVariableExpenses';
import { usePersonnel } from './usePersonnel';
import { useDirectors } from './useDirectors';
import { useInvestments } from './useInvestments';
import { useBPSettings } from './useBPSettings';
import { startOfMonth, addMonths } from 'date-fns';
import { calculateIS, TVA_RATES_FR } from '@/lib/french-rates';

export interface PLRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total' | 'sig';
  values: number[];
  isExpense?: boolean;
  indent?: number;
}

export interface PLData {
  months: Date[];
  rows: PLRow[];
  totals: {
    revenue: number[];
    fixedExpenses: number[];
    variableExpenses: number[];
    personnelCosts: number[];
    directorsCosts: number[];
    depreciation: number[];
    ebitda: number[];
    operatingResult: number[];
    netResultBeforeTax: number[];
    corporateTax: number[];
    netResult: number[];
  };
  annualSummary: {
    revenue: number;
    fixedExpenses: number;
    variableExpenses: number;
    personnelCosts: number;
    directorsCosts: number;
    depreciation: number;
    ebitda: number;
    operatingResult: number;
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
  const { settings, isLoading: settingsLoading } = useBPSettings();

  const isLoading = revenueLoading || expensesLoading || variableExpensesLoading || personnelLoading || directorsLoading || investmentsLoading || settingsLoading;

  const data = useMemo<PLData>(() => {
    const months: Date[] = [];
    const projectionMonths = settings.projection_months || 24;
    
    for (let i = 0; i < Math.min(projectionMonths, 24); i++) {
      months.push(addMonths(startOfMonth(new Date()), i));
    }

    const rows: PLRow[] = [];

    // ═══════════════════════════════════════════════════════════════
    // PRODUITS D'EXPLOITATION
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'PRODUITS D\'EXPLOITATION', type: 'header', values: [] });
    
    // Chiffre d'affaires par flux
    streams.forEach(stream => {
      const values = months.map(month => getForecast(stream.id, month));
      rows.push({
        label: stream.name,
        type: 'item',
        values,
        indent: 1,
      });
    });

    const revenueValues = months.map(month => 
      streams.reduce((sum, stream) => sum + getForecast(stream.id, month), 0)
    );
    rows.push({ label: 'Chiffre d\'affaires', type: 'subtotal', values: revenueValues });

    // ═══════════════════════════════════════════════════════════════
    // CHARGES D'EXPLOITATION
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'CHARGES D\'EXPLOITATION', type: 'header', values: [], isExpense: true });

    // Charges variables (coûts proportionnels au CA)
    const variableExpenseValues = months.map((month, monthIndex) => {
      // Build revenue by stream for this month
      const revenueByStream = new Map<string | null, { amount: number; units: number }>();
      streams.forEach(stream => {
        const amount = getForecast(stream.id, month);
        // For simplicity, we estimate units from the forecast data or default to 1
        revenueByStream.set(stream.id, { amount, units: 1 });
      });
      
      return variableExpenses.reduce((total, expense) => {
        return total + calculateVariableExpenseForMonth(expense, month, revenueByStream);
      }, 0);
    });

    if (variableExpenses.length > 0) {
      rows.push({ label: 'Charges variables', type: 'header', values: [], isExpense: true, indent: 1 });
      
      variableExpenses.forEach(expense => {
        const values = months.map((month) => {
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
      const values = months.map(month => {
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

    const fixedExpenseValues = months.map(month => getExpensesTotal(month));
    rows.push({ label: 'Total charges fixes', type: 'subtotal', values: fixedExpenseValues, isExpense: true });

    // Charges de personnel
    rows.push({ label: 'Charges de personnel', type: 'header', values: [], isExpense: true, indent: 1 });
    
    const grossSalaryValues = months.map(month => getBreakdownForMonth(month).grossSalaries);
    rows.push({ label: 'Salaires bruts', type: 'item', values: grossSalaryValues, isExpense: true, indent: 2 });
    
    const chargesValues = months.map(month => getBreakdownForMonth(month).employerCharges);
    rows.push({ label: 'Charges sociales patronales', type: 'item', values: chargesValues, isExpense: true, indent: 2 });

    const personnelValues = months.map(month => getBreakdownForMonth(month).total);
    rows.push({ label: 'Total personnel salarié', type: 'subtotal', values: personnelValues, isExpense: true });

    // Rémunération des dirigeants
    const directorRemunerationValues = months.map(month => getDirectorsBreakdown(month).remuneration);
    const directorChargesValues = months.map(month => getDirectorsBreakdown(month).charges);
    const directorTotalValues = months.map(month => getDirectorsBreakdown(month).total);

    if (directors.length > 0) {
      rows.push({ label: 'Rémunération dirigeants', type: 'header', values: [], isExpense: true, indent: 1 });
      rows.push({ label: 'Rémunération nette', type: 'item', values: directorRemunerationValues, isExpense: true, indent: 2 });
      rows.push({ label: 'Charges sociales', type: 'item', values: directorChargesValues, isExpense: true, indent: 2 });
      rows.push({ label: 'Total dirigeants', type: 'subtotal', values: directorTotalValues, isExpense: true });
    }

    // Dotations aux amortissements
    const depreciationValues = months.map(month => getDepreciationForMonth(month));
    if (depreciationValues.some(v => v > 0)) {
      rows.push({ label: 'Dotations aux amortissements', type: 'item', values: depreciationValues, isExpense: true });
    }

    // Total charges d'exploitation
    const totalExpenseValues = months.map((_, i) => 
      variableExpenseValues[i] + fixedExpenseValues[i] + personnelValues[i] + directorTotalValues[i] + depreciationValues[i]
    );
    rows.push({ label: 'Total charges d\'exploitation', type: 'subtotal', values: totalExpenseValues, isExpense: true });

    // ═══════════════════════════════════════════════════════════════
    // SOLDES INTERMÉDIAIRES DE GESTION (SIG)
    // ═══════════════════════════════════════════════════════════════

    // Marge brute = CA - Charges variables
    const grossMarginValues = months.map((_, i) => revenueValues[i] - variableExpenseValues[i]);
    rows.push({ label: 'MARGE BRUTE', type: 'sig', values: grossMarginValues });

    // Valeur Ajoutée = Marge brute - Charges fixes
    const vaValues = months.map((_, i) => grossMarginValues[i] - fixedExpenseValues[i]);
    rows.push({ label: 'VALEUR AJOUTÉE', type: 'sig', values: vaValues });

    // EBE = VA - Charges de personnel - Rémunération dirigeants
    const ebeValues = months.map((_, i) => 
      vaValues[i] - personnelValues[i] - directorTotalValues[i]
    );
    rows.push({ label: 'EXCÉDENT BRUT D\'EXPLOITATION (EBE)', type: 'sig', values: ebeValues });

    // Résultat d'exploitation = EBE - Amortissements
    const operatingResultValues = months.map((_, i) => ebeValues[i] - depreciationValues[i]);
    rows.push({ label: 'RÉSULTAT D\'EXPLOITATION', type: 'sig', values: operatingResultValues });

    // Résultat financier (simplifié: 0 pour l'instant)
    const financialResultValues = months.map(() => 0);
    rows.push({ label: 'Résultat financier', type: 'item', values: financialResultValues });

    // RCAI = Résultat d'exploitation + Résultat financier
    const rcaiValues = months.map((_, i) => operatingResultValues[i] + financialResultValues[i]);
    rows.push({ label: 'RÉSULTAT COURANT AVANT IMPÔTS (RCAI)', type: 'sig', values: rcaiValues });

    // Impôt sur les sociétés
    const isPME = settings.is_pme !== false;
    const isValues = months.map((_, i) => {
      // Calculer l'IS sur le résultat cumulé jusqu'à ce mois (approximation mensuelle)
      const monthlyResult = rcaiValues[i];
      // Simplification: IS proportionnel au résultat mensuel
      const cumulativeResult = rcaiValues.slice(0, i + 1).reduce((a, b) => a + b, 0);
      const cumulativeIS = calculateIS(Math.max(0, cumulativeResult), isPME);
      const previousCumulativeResult = i > 0 ? rcaiValues.slice(0, i).reduce((a, b) => a + b, 0) : 0;
      const previousCumulativeIS = i > 0 ? calculateIS(Math.max(0, previousCumulativeResult), isPME) : 0;
      return cumulativeIS - previousCumulativeIS;
    });
    rows.push({ label: 'Impôt sur les sociétés', type: 'item', values: isValues, isExpense: true });

    // Résultat Net = RCAI - IS
    const netResultValues = months.map((_, i) => rcaiValues[i] - isValues[i]);
    rows.push({ label: 'RÉSULTAT NET', type: 'total', values: netResultValues });

    // ═══════════════════════════════════════════════════════════════
    // TVA
    // ═══════════════════════════════════════════════════════════════
    const tvaCollectedValues = months.map(month => {
      return streams.reduce((sum, stream) => {
        const revenue = getForecast(stream.id, month);
        const vatRate = (stream as any).vat_rate ?? TVA_RATES_FR.standard;
        return sum + (revenue * vatRate);
      }, 0);
    });

    const tvaDeductibleValues = months.map((month, monthIndex) => {
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

    const tvaBalanceValues = months.map((_, i) => tvaCollectedValues[i] - tvaDeductibleValues[i]);

    // Annual summary
    const sum12 = (arr: number[]) => arr.slice(0, 12).reduce((a, b) => a + b, 0);
    const totalRevenue = sum12(revenueValues);
    const totalVariableExpenses = sum12(variableExpenseValues);
    
    const annualSummary = {
      revenue: totalRevenue,
      fixedExpenses: sum12(fixedExpenseValues),
      variableExpenses: totalVariableExpenses,
      personnelCosts: sum12(personnelValues),
      directorsCosts: sum12(directorTotalValues),
      depreciation: sum12(depreciationValues),
      ebitda: sum12(ebeValues),
      operatingResult: sum12(operatingResultValues),
      netResultBeforeTax: sum12(rcaiValues),
      corporateTax: sum12(isValues),
      netResult: sum12(netResultValues),
      grossMarginPercent: totalRevenue > 0 ? ((totalRevenue - totalVariableExpenses) / totalRevenue) * 100 : 0,
      ebitdaMarginPercent: totalRevenue > 0 ? (sum12(ebeValues) / totalRevenue) * 100 : 0,
    };

    return {
      months,
      rows,
      totals: {
        revenue: revenueValues,
        fixedExpenses: fixedExpenseValues,
        variableExpenses: variableExpenseValues,
        personnelCosts: personnelValues,
        directorsCosts: directorTotalValues,
        depreciation: depreciationValues,
        ebitda: ebeValues,
        operatingResult: operatingResultValues,
        netResultBeforeTax: rcaiValues,
        corporateTax: isValues,
        netResult: netResultValues,
      },
      annualSummary,
      tva: {
        collected: tvaCollectedValues,
        deductible: tvaDeductibleValues,
        balance: tvaBalanceValues,
      },
    };
  }, [streams, expenses, allExpenses, variableExpenses, personnel, directors, settings, getForecast, getExpensesTotal, calculateVariableExpenseForMonth, getBreakdownForMonth, getDirectorsBreakdown, getDepreciationForMonth]);

  // Helper: get break-even month
  const getBreakEvenMonth = (): number | null => {
    let cumulative = 0;
    for (let i = 0; i < data.totals.netResult.length; i++) {
      cumulative += data.totals.netResult[i];
      if (cumulative > 0) return i + 1;
    }
    return null;
  };

  // Helper: get gross margin percentage
  const getGrossMargin = (): number => {
    return data.annualSummary.grossMarginPercent;
  };

  // Helper: get EBITDA margin
  const getEBITDAMargin = (): number => {
    return data.annualSummary.ebitdaMarginPercent;
  };

  return {
    data,
    isLoading,
    getBreakEvenMonth,
    getGrossMargin,
    getEBITDAMargin,
  };
}
