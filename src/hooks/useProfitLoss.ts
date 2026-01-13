import { useMemo } from 'react';
import { useRevenueStreams } from './useRevenueStreams';
import { useFixedExpenses } from './useFixedExpenses';
import { usePersonnel } from './usePersonnel';
import { useBPSettings } from './useBPSettings';
import { startOfMonth, addMonths, format } from 'date-fns';

export interface PLRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total';
  values: number[];
  isExpense?: boolean;
}

export interface PLData {
  months: Date[];
  rows: PLRow[];
  totals: {
    revenue: number[];
    fixedExpenses: number[];
    personnelCosts: number[];
    ebitda: number[];
    netResult: number[];
  };
  annualSummary: {
    revenue: number;
    fixedExpenses: number;
    personnelCosts: number;
    ebitda: number;
    netResult: number;
  };
}

export function useProfitLoss() {
  const { streams, getForecast, isLoading: revenueLoading } = useRevenueStreams();
  const { expenses, getTotalForMonth: getExpensesTotal, isLoading: expensesLoading } = useFixedExpenses();
  const { personnel, getBreakdownForMonth, isLoading: personnelLoading } = usePersonnel();
  const { settings, isLoading: settingsLoading } = useBPSettings();

  const isLoading = revenueLoading || expensesLoading || personnelLoading || settingsLoading;

  const data = useMemo<PLData>(() => {
    const months: Date[] = [];
    const projectionMonths = settings.projection_months || 24;
    
    for (let i = 0; i < Math.min(projectionMonths, 24); i++) {
      months.push(addMonths(startOfMonth(new Date()), i));
    }

    const rows: PLRow[] = [];

    // Revenue section
    rows.push({ label: 'CHIFFRE D\'AFFAIRES', type: 'header', values: [] });
    
    streams.forEach(stream => {
      const values = months.map(month => getForecast(stream.id, month));
      rows.push({
        label: stream.name,
        type: 'item',
        values,
      });
    });

    const revenueValues = months.map(month => 
      streams.reduce((sum, stream) => sum + getForecast(stream.id, month), 0)
    );
    rows.push({ label: 'Total CA', type: 'subtotal', values: revenueValues });

    // Fixed expenses section
    rows.push({ label: 'CHARGES FIXES', type: 'header', values: [], isExpense: true });
    
    expenses.forEach(expense => {
      const values = months.map(month => {
        // Check if expense is active for this month
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
      });
    });

    const fixedExpenseValues = months.map(month => getExpensesTotal(month));
    rows.push({ label: 'Total Charges Fixes', type: 'subtotal', values: fixedExpenseValues, isExpense: true });

    // Personnel section
    rows.push({ label: 'MASSE SALARIALE', type: 'header', values: [], isExpense: true });
    
    const grossSalaryValues = months.map(month => getBreakdownForMonth(month).grossSalaries);
    rows.push({ label: 'Salaires bruts', type: 'item', values: grossSalaryValues, isExpense: true });
    
    const chargesValues = months.map(month => getBreakdownForMonth(month).employerCharges);
    rows.push({ label: 'Charges patronales', type: 'item', values: chargesValues, isExpense: true });

    const personnelValues = months.map(month => getBreakdownForMonth(month).total);
    rows.push({ label: 'Total Personnel', type: 'subtotal', values: personnelValues, isExpense: true });

    // EBITDA
    const ebitdaValues = months.map((_, i) => 
      revenueValues[i] - fixedExpenseValues[i] - personnelValues[i]
    );
    rows.push({ label: 'EBITDA', type: 'total', values: ebitdaValues });

    // Net result (same as EBITDA for now, no depreciation/taxes in this simplified model)
    rows.push({ label: 'RÉSULTAT NET', type: 'total', values: ebitdaValues });

    // Annual summary
    const annualSummary = {
      revenue: revenueValues.slice(0, 12).reduce((a, b) => a + b, 0),
      fixedExpenses: fixedExpenseValues.slice(0, 12).reduce((a, b) => a + b, 0),
      personnelCosts: personnelValues.slice(0, 12).reduce((a, b) => a + b, 0),
      ebitda: ebitdaValues.slice(0, 12).reduce((a, b) => a + b, 0),
      netResult: ebitdaValues.slice(0, 12).reduce((a, b) => a + b, 0),
    };

    return {
      months,
      rows,
      totals: {
        revenue: revenueValues,
        fixedExpenses: fixedExpenseValues,
        personnelCosts: personnelValues,
        ebitda: ebitdaValues,
        netResult: ebitdaValues,
      },
      annualSummary,
    };
  }, [streams, expenses, personnel, settings, getForecast, getExpensesTotal, getBreakdownForMonth]);

  // Helper: get break-even month (first month where cumulative result is positive)
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
    const totalRevenue = data.annualSummary.revenue;
    if (totalRevenue === 0) return 0;
    const totalCosts = data.annualSummary.fixedExpenses + data.annualSummary.personnelCosts;
    return ((totalRevenue - totalCosts) / totalRevenue) * 100;
  };

  return {
    data,
    isLoading,
    getBreakEvenMonth,
    getGrossMargin,
  };
}
