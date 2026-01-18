// ============================================
// useProfitLoss Hook - Company-based version
// Uses company_id to fetch all related data
// ============================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useBPSettings } from './useBPSettings';
import { startOfMonth, addMonths, parseISO, format } from 'date-fns';
import { calculateTaxByRegime, TVA_RATES_FR, TaxRegime, getGlobalChargesRate } from '@/lib/french-rates';
import { PAYMENT_FREQUENCIES, DEFAULT_PAYMENT_MONTHS } from '@/constants/bpConstants';

export interface PLRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total' | 'sig';
  values: number[];
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
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { settings, isLoading: settingsLoading } = useBPSettings();
  const companyId = currentCompany?.id;

  // Fetch all BP data in parallel using company_id
  const { data: streams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ['bp_revenue_streams', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_revenue_streams')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  const { data: fixedExpenses = [], isLoading: fixedLoading } = useQuery({
    queryKey: ['bp_fixed_expenses', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_fixed_expenses')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  const { data: variableExpenses = [], isLoading: variableLoading } = useQuery({
    queryKey: ['bp_variable_expenses', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_variable_expenses')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  const { data: personnel = [], isLoading: personnelLoading } = useQuery({
    queryKey: ['bp_personnel', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_personnel')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  const { data: directors = [], isLoading: directorsLoading } = useQuery({
    queryKey: ['bp_directors', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_directors')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  const { data: investments = [], isLoading: investmentsLoading } = useQuery({
    queryKey: ['bp_investments', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_investments')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  const { data: financings = [], isLoading: financingsLoading } = useQuery({
    queryKey: ['bp_financings', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_financings')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  // Fetch forecasts by stream_ids
  const streamIds = streams.map(s => s.id);
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['bp_revenue_forecasts_by_streams', streamIds],
    queryFn: async () => {
      if (streamIds.length === 0) return [];
      const { data, error } = await supabase
        .from('bp_revenue_forecasts')
        .select('*')
        .in('stream_id', streamIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && streamIds.length > 0,
  });

  const isLoading = settingsLoading || streamsLoading || fixedLoading || variableLoading || 
                    personnelLoading || directorsLoading || investmentsLoading || 
                    financingsLoading || forecastsLoading;

  // Helper functions for calculations
  const isPersonnelActiveForMonth = (person: any, month: Date): boolean => {
    const monthStart = startOfMonth(month);
    const startDate = parseISO(person.start_date);
    const endDate = person.end_date ? parseISO(person.end_date) : null;
    if (monthStart < startOfMonth(startDate)) return false;
    if (endDate && monthStart > startOfMonth(endDate)) return false;
    return true;
  };

  const getPersonnelCost = (person: any): number => {
    if (person.worker_type === 'freelance') {
      const dailyRate = Number(person.daily_rate) || 0;
      const daysPerMonth = Number(person.estimated_days_per_month) || 0;
      return dailyRate * daysPerMonth;
    }
    const salary = Number(person.gross_salary) || 0;
    const chargesRate = Number(person.employer_charges_rate) || 
      getGlobalChargesRate(salary, person.is_executive, person.company_size || 'small', person.contract_type || 'cdi');
    return salary + (salary * chargesRate);
  };

  const getPersonnelBreakdownForMonth = (month: Date) => {
    const activePersonnel = personnel.filter(p => 
      isPersonnelActiveForMonth(p, month) && p.worker_type !== 'freelance'
    );
    const grossSalaries = activePersonnel.reduce((sum, p) => sum + (Number(p.gross_salary) || 0), 0);
    const employerCharges = activePersonnel.reduce((sum, p) => {
      const salary = Number(p.gross_salary) || 0;
      const rate = Number(p.employer_charges_rate) || 0;
      return sum + (salary * rate);
    }, 0);
    return { grossSalaries, employerCharges, total: grossSalaries + employerCharges };
  };

  const getDirectorsBreakdownForMonth = (month: Date) => {
    const activeDirectors = directors.filter(d => {
      const monthStart = startOfMonth(month);
      const startDate = parseISO(d.start_date);
      const endDate = d.end_date ? parseISO(d.end_date) : null;
      if (monthStart < startOfMonth(startDate)) return false;
      if (endDate && monthStart > startOfMonth(endDate)) return false;
      return true;
    });
    const remuneration = activeDirectors.reduce((sum, d) => sum + (Number(d.monthly_remuneration) || 0), 0);
    const charges = activeDirectors.reduce((sum, d) => {
      const rem = Number(d.monthly_remuneration) || 0;
      const rate = Number(d.charges_rate) || 0;
      return sum + (rem * rate);
    }, 0);
    return { remuneration, charges, total: remuneration + charges };
  };

  const getFixedExpenseForMonth = (expense: any, month: Date): number => {
    const monthStart = startOfMonth(month);
    const startDate = parseISO(expense.start_date);
    const endDate = expense.end_date ? parseISO(expense.end_date) : null;
    if (monthStart < startOfMonth(startDate)) return 0;
    if (endDate && monthStart > startOfMonth(endDate)) return 0;
    
    const freq = expense.payment_frequency || 'monthly';
    const multiplier = PAYMENT_FREQUENCIES[freq]?.multiplier || 1;
    return (Number(expense.monthly_amount) || 0) / multiplier;
  };

  const getRevenueForecast = (streamId: string, month: Date): number => {
    const stream = streams.find(s => s.id === streamId);
    if (!stream) return 0;

    if (stream.model === 'subscription') {
      const startMonth = startOfMonth(new Date(settings.bp_start_date || new Date()));
      const targetMonth = startOfMonth(month);
      const monthsDiff = Math.round((targetMonth.getTime() - startMonth.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (monthsDiff < 0) return 0;
      const netGrowth = (stream.growth_rate || 0.10) - (stream.churn_rate || 0.05);
      const subscribers = Math.round((stream.initial_subscribers || 0) * Math.pow(1 + netGrowth, monthsDiff));
      return subscribers * (stream.monthly_price || 0);
    }

    const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');
    const forecast = forecasts.find(f => f.stream_id === streamId && f.month === monthStr);
    return forecast?.amount || stream.monthly_price || 0;
  };

  const getDepreciationForMonth = (month: Date): number => {
    return investments.reduce((sum, inv) => {
      const purchaseDate = parseISO(inv.purchase_date);
      const monthStart = startOfMonth(month);
      if (monthStart < startOfMonth(purchaseDate)) return sum;
      
      const years = inv.depreciation_years || 5;
      const endDate = addMonths(purchaseDate, years * 12);
      if (monthStart >= endDate) return sum;
      
      const monthlyDepreciation = (inv.purchase_amount || 0) / (years * 12);
      return sum + monthlyDepreciation;
    }, 0);
  };

  const showFinancing = settings.show_financing !== false;
  
  const getMonthlyLeasePayments = (month: Date): number => {
    if (!showFinancing) return 0;
    return financings.filter(f => f.financing_type === 'leasing').reduce((sum, fin) => {
      const startDate = parseISO(fin.start_date);
      const endDate = fin.end_date ? parseISO(fin.end_date) : null;
      const monthStart = startOfMonth(month);
      if (monthStart < startOfMonth(startDate)) return sum;
      if (endDate && monthStart > startOfMonth(endDate)) return sum;
      return sum + (Number(fin.monthly_payment) || 0);
    }, 0);
  };

  const getMonthlyInterestExpense = (month: Date): number => {
    if (!showFinancing) return 0;
    return financings.filter(f => f.financing_type === 'loan').reduce((sum, fin) => {
      const startDate = parseISO(fin.start_date);
      const endDate = fin.end_date ? parseISO(fin.end_date) : null;
      const monthStart = startOfMonth(month);
      if (monthStart < startOfMonth(startDate)) return sum;
      if (endDate && monthStart > startOfMonth(endDate)) return sum;
      const rate = (fin.interest_rate || 0) / 100 / 12;
      const principal = fin.amount || 0;
      return sum + (principal * rate);
    }, 0);
  };

  const calculateVariableExpenseForMonth = (expense: any, month: Date, revenueByStream: Map<string | null, { amount: number; units: number }>): number => {
    const monthStart = startOfMonth(month);
    const startDate = parseISO(expense.start_date);
    const endDate = expense.end_date ? parseISO(expense.end_date) : null;
    if (monthStart < startOfMonth(startDate)) return 0;
    if (endDate && monthStart > startOfMonth(endDate)) return 0;

    let relevantAmount = 0;
    if (expense.linked_revenue_stream_id) {
      const streamData = revenueByStream.get(expense.linked_revenue_stream_id);
      if (streamData) relevantAmount = streamData.amount;
    } else {
      revenueByStream.forEach(data => { relevantAmount += data.amount; });
    }

    if (expense.calculation_type === 'percentage') {
      return (relevantAmount * (expense.percentage || 0)) / 100;
    }
    return (expense.unit_cost || 0);
  };

  // Build fiscal years from settings
  const getFiscalYears = (): FiscalYear[] => {
    const startDate = settings.bp_start_date ? new Date(settings.bp_start_date) : new Date();
    const startMonth = settings.fiscal_year_start_month || 1;
    const startDay = settings.fiscal_year_start_day || 1;
    const numYears = settings.bp_years || 3;

    const years: FiscalYear[] = [];
    let fiscalYearStart = new Date(startDate.getFullYear(), startMonth - 1, startDay);
    if (fiscalYearStart > startDate) {
      fiscalYearStart = new Date(startDate.getFullYear() - 1, startMonth - 1, startDay);
    }

    for (let i = 0; i < numYears; i++) {
      const yearStart = new Date(fiscalYearStart);
      yearStart.setFullYear(yearStart.getFullYear() + i);
      
      const yearEnd = new Date(yearStart);
      yearEnd.setFullYear(yearEnd.getFullYear() + 1);
      yearEnd.setDate(yearEnd.getDate() - 1);

      const months: Date[] = [];
      let currentMonth = startOfMonth(yearStart);
      while (currentMonth <= yearEnd) {
        months.push(currentMonth);
        currentMonth = addMonths(currentMonth, 1);
      }

      years.push({ start: yearStart, end: yearEnd, label: `Année ${i + 1}`, months });
    }

    return years;
  };

  const data = useMemo<PLData>(() => {
    const years = getFiscalYears();

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
    
    streams.forEach(stream => {
      const values = calculateYearlyValues(month => getRevenueForecast(stream.id, month));
      rows.push({ label: stream.name, type: 'item', values, indent: 1 });
    });

    const revenueValues = calculateYearlyValues(month => 
      streams.reduce((sum, stream) => sum + getRevenueForecast(stream.id, month), 0)
    );
    rows.push({ label: 'Chiffre d\'affaires', type: 'subtotal', values: revenueValues });

    // ═══════════════════════════════════════════════════════════════
    // CHARGES D'EXPLOITATION
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'CHARGES D\'EXPLOITATION', type: 'header', values: [], isExpense: true });

    // Charges variables
    const variableExpenseValues = calculateYearlyValues(month => {
      const revenueByStream = new Map<string | null, { amount: number; units: number }>();
      streams.forEach(stream => {
        const amount = getRevenueForecast(stream.id, month);
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
            const amount = getRevenueForecast(stream.id, month);
            revenueByStream.set(stream.id, { amount, units: 1 });
          });
          return calculateVariableExpenseForMonth(expense, month, revenueByStream);
        });
        rows.push({ label: expense.name, type: 'item', values, isExpense: true, indent: 2 });
      });
      rows.push({ label: 'Total charges variables', type: 'subtotal', values: variableExpenseValues, isExpense: true });
    }

    // Charges fixes
    rows.push({ label: 'Achats et charges externes', type: 'header', values: [], isExpense: true, indent: 1 });
    fixedExpenses.forEach(expense => {
      const values = calculateYearlyValues(month => getFixedExpenseForMonth(expense, month));
      rows.push({ label: expense.name, type: 'item', values, isExpense: true, indent: 2 });
    });

    const fixedExpenseValues = calculateYearlyValues(month => 
      fixedExpenses.reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0)
    );
    rows.push({ label: 'Total charges fixes', type: 'subtotal', values: fixedExpenseValues, isExpense: true });

    // Charges de personnel
    rows.push({ label: 'Charges de personnel', type: 'header', values: [], isExpense: true, indent: 1 });
    
    const grossSalaryValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).grossSalaries);
    rows.push({ label: 'Salaires bruts', type: 'item', values: grossSalaryValues, isExpense: true, indent: 2 });
    
    const chargesValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).employerCharges);
    rows.push({ label: 'Charges sociales patronales', type: 'item', values: chargesValues, isExpense: true, indent: 2 });

    const personnelValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).total);
    rows.push({ label: 'Total personnel salarié', type: 'subtotal', values: personnelValues, isExpense: true });

    // Rémunération des dirigeants
    const directorTotalValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).total);

    if (directors.length > 0) {
      rows.push({ label: 'Rémunération dirigeants', type: 'header', values: [], isExpense: true, indent: 1 });
      const directorRemunerationValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).remuneration);
      const directorChargesValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).charges);
      rows.push({ label: 'Rémunération nette', type: 'item', values: directorRemunerationValues, isExpense: true, indent: 2 });
      rows.push({ label: 'Charges sociales', type: 'item', values: directorChargesValues, isExpense: true, indent: 2 });
      rows.push({ label: 'Total dirigeants', type: 'subtotal', values: directorTotalValues, isExpense: true });
    }

    // Dotations aux amortissements
    const depreciationValues = calculateYearlyValues(month => getDepreciationForMonth(month));
    if (depreciationValues.some(v => v > 0)) {
      rows.push({ label: 'Dotations aux amortissements', type: 'item', values: depreciationValues, isExpense: true });
    }

    // Loyers de crédit-bail
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
    const grossMarginValues = years.map((_, i) => revenueValues[i] - variableExpenseValues[i]);
    rows.push({ label: 'MARGE BRUTE', type: 'sig', values: grossMarginValues });

    const vaValues = years.map((_, i) => grossMarginValues[i] - fixedExpenseValues[i]);
    rows.push({ label: 'VALEUR AJOUTÉE', type: 'sig', values: vaValues });

    const ebeValues = years.map((_, i) => 
      vaValues[i] - personnelValues[i] - directorTotalValues[i] - leaseExpenseValues[i]
    );
    rows.push({ label: 'EXCÉDENT BRUT D\'EXPLOITATION (EBE)', type: 'sig', values: ebeValues });

    const operatingResultValues = years.map((_, i) => ebeValues[i] - depreciationValues[i]);
    rows.push({ label: 'RÉSULTAT D\'EXPLOITATION', type: 'sig', values: operatingResultValues });

    const financialResultValues = calculateYearlyValues(month => -getMonthlyInterestExpense(month));
    rows.push({ label: 'Résultat financier', type: 'item', values: financialResultValues, isExpense: financialResultValues.some(v => v < 0) });

    const rcaiValues = years.map((_, i) => operatingResultValues[i] + financialResultValues[i]);
    rows.push({ label: 'RÉSULTAT COURANT AVANT IMPÔTS (RCAI)', type: 'sig', values: rcaiValues });

    // Impôt
    const taxRegime = (settings.tax_regime || 'is') as TaxRegime;
    const isPME = settings.is_pme !== false;
    
    const taxValues = years.map((_, i) => {
      const yearResult = rcaiValues[i];
      const yearRevenue = revenueValues[i];
      const taxResult = calculateTaxByRegime(Math.max(0, yearResult), taxRegime, {
        isPME,
        activityType: 'services',
        chiffreAffaires: yearRevenue,
      });
      return taxResult.tax;
    });
    
    const taxLabel = taxRegime === 'is' ? 'Impôt sur les sociétés' : taxRegime === 'ir' ? 'Impôt sur le revenu' : 'Impôt (micro-entreprise)';
    rows.push({ label: taxLabel, type: 'item', values: taxValues, isExpense: true });

    const netResultValues = years.map((_, i) => rcaiValues[i] - taxValues[i]);
    rows.push({ label: 'RÉSULTAT NET', type: 'total', values: netResultValues });

    // TVA
    const tvaCollectedValues = calculateYearlyValues(month => {
      return streams.reduce((sum, stream) => {
        const revenue = getRevenueForecast(stream.id, month);
        const vatRate = stream.vat_rate ?? TVA_RATES_FR.standard;
        return sum + (revenue * vatRate);
      }, 0);
    });

    const tvaDeductibleValues = calculateYearlyValues(month => {
      return fixedExpenses.reduce((sum, expense) => {
        const expenseAmount = getFixedExpenseForMonth(expense, month);
        const vatRate = expense.vat_rate ?? TVA_RATES_FR.standard;
        const isDeductible = expense.is_vat_deductible !== false;
        return sum + (isDeductible ? expenseAmount * vatRate : 0);
      }, 0);
    });

    const tvaBalanceValues = years.map((_, i) => tvaCollectedValues[i] - tvaDeductibleValues[i]);

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
      corporateTax: sumAll(taxValues),
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
        corporateTax: taxValues,
        netResult: netResultValues,
      },
      grandTotal,
      tva: {
        collected: tvaCollectedValues,
        deductible: tvaDeductibleValues,
        balance: tvaBalanceValues,
      },
    };
  }, [streams, fixedExpenses, variableExpenses, personnel, directors, investments, financings, forecasts, settings]);

  const getBreakEvenYear = (): number | null => {
    let cumulative = 0;
    for (let i = 0; i < data.totals.netResult.length; i++) {
      cumulative += data.totals.netResult[i];
      if (cumulative > 0) return i + 1;
    }
    return null;
  };

  const getGrossMargin = (): number => data.grandTotal.grossMarginPercent;
  const getEBITDAMargin = (): number => data.grandTotal.ebitdaMarginPercent;

  return {
    data,
    isLoading,
    getBreakEvenYear,
    getGrossMargin,
    getEBITDAMargin,
  };
}
