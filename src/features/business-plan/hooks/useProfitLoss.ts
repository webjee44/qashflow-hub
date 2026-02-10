// ============================================
// useProfitLoss Hook - PCG Compliant Version
// Restructuré selon les normes bancaires françaises (SIG)
// Uses company_id to fetch all related data
// ============================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useBPSettings } from './useBPSettings';
import { useStocks } from './useStocks';
import { startOfMonth, addMonths, parseISO, format, differenceInMonths } from 'date-fns';
import { calculateTaxByRegime, TVA_RATES_FR, TaxRegime, getGlobalChargesRate, URSSAF_RATES_2026, SEVERANCE_FORFAIT_SOCIAL, getLoanScheduleEntry } from '@/lib/french-rates';
import { PAYMENT_FREQUENCIES, DEPARTURE_TYPES } from '@/constants/bpConstants';

export interface PLRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total' | 'sig';
  values: number[];
  isExpense?: boolean;
  indent?: number;
  sectionType?: 'revenue' | 'expense' | 'result';
  pcgCode?: string;
  isSIG?: boolean;
  /** Optional array of % of revenue values to display as badge per year */
  percentOfRevenue?: number[];
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
    // Revenus
    merchandiseSales: number[];     // 707
    productionSold: number[];       // 706
    operatingGrants: number[];      // 74
    revenue: number[];
    
    // Charges
    merchandisePurchases: number[]; // 607
    stockVariation: number[];       // 603/713
    externalServices: number[];     // 61/62
    taxes: number[];                // 63
    personnel: number[];            // 64
    depreciation: number[];         // 68
    
    // Legacy (for backward compatibility)
    cogs: number[];
    fixedExpenses: number[];
    variableExpenses: number[];
    personnelCosts: number[];
    directorsCosts: number[];
    leaseExpenses: number[];
    payrollTaxes: number[];
    severancePayments: number[];
    
    // SIG
    commercialMargin: number[];
    valueAdded: number[];
    ebitda: number[];
    operatingResult: number[];
    financialResult: number[];
    netResultBeforeTax: number[];
    corporateTax: number[];
    netResult: number[];
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
  const { getStockVariation } = useStocks();
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

  const getFreelanceCostsForMonth = (month: Date) => {
    const activeFreelancers = personnel.filter(p => 
      isPersonnelActiveForMonth(p, month) && p.worker_type === 'freelance'
    );
    return activeFreelancers.reduce((sum, p) => {
      const dailyRate = Number(p.daily_rate) || 0;
      const daysPerMonth = Number(p.estimated_days_per_month) || 0;
      return sum + (dailyRate * daysPerMonth);
    }, 0);
  };

  const getSeverancePaymentsForMonth = (month: Date) => {
    const monthStart = startOfMonth(month);
    
    return personnel.reduce((sum, person) => {
      if (!person.end_date || !person.severance_amount || !person.departure_type) return sum;
      
      const endDate = parseISO(person.end_date);
      if (startOfMonth(endDate).getTime() !== monthStart.getTime()) return sum;
      
      const departureConfig = DEPARTURE_TYPES[person.departure_type as keyof typeof DEPARTURE_TYPES];
      const employerRate = departureConfig?.employerContributionRate ?? SEVERANCE_FORFAIT_SOCIAL;
      const severance = Number(person.severance_amount) || 0;
      const employerCost = severance * (1 + employerRate);
      
      return sum + employerCost;
    }, 0);
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

    const startDate = settings.bp_start_date ? new Date(settings.bp_start_date) : new Date();
    const targetMonth = startOfMonth(month);

    if (stream.model === 'subscription') {
      const startMonth = startOfMonth(startDate);
      const monthsDiff = Math.round((targetMonth.getTime() - startMonth.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (monthsDiff < 0) return 0;
      const netGrowth = (stream.growth_rate || 0.10) - (stream.churn_rate || 0.05);
      const subscribers = Math.round((stream.initial_subscribers || 0) * Math.pow(1 + netGrowth, monthsDiff));
      return subscribers * (stream.monthly_price || 0);
    }

    const monthStr = format(targetMonth, 'yyyy-MM-dd');
    const forecast = forecasts.find(f => f.stream_id === streamId && f.month === monthStr);
    if (forecast?.amount) return forecast.amount;

    const targetMonthOfYear = targetMonth.getMonth();
    const bpStartYear = startDate.getFullYear();
    const targetYear = targetMonth.getFullYear();
    const yearOffset = targetYear - bpStartYear;

    if (yearOffset <= 0) {
      return stream.monthly_price || 0;
    }

    const baseMonthStr = format(new Date(bpStartYear, targetMonthOfYear, 1), 'yyyy-MM-dd');
    const baseForecast = forecasts.find(f => f.stream_id === streamId && f.month === baseMonthStr);
    const baseAmount = baseForecast?.amount || stream.monthly_price || 0;

    if (baseAmount === 0) return 0;

    let projectedAmount = baseAmount;
    
    for (let y = 1; y <= yearOffset; y++) {
      let growthRate = stream.growth_rate || 0;
      if (y === 1) growthRate = stream.growth_rate_year2 ?? stream.growth_rate ?? 0;
      else if (y === 2) growthRate = stream.growth_rate_year3 ?? stream.growth_rate ?? 0;
      else growthRate = stream.growth_rate_year4 ?? stream.growth_rate ?? 0;
      
      projectedAmount = projectedAmount * (1 + growthRate);
    }

    return Math.round(projectedAmount * 100) / 100;
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
  
  // Crédit-bail → Services Extérieurs (612) - impacte VA et EBE
  const getMonthlyLeasePayments = (month: Date): number => {
    if (!showFinancing) return 0;
    return financings.filter(f => f.financing_type === 'lease').reduce((sum, fin) => {
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
      const monthStart = startOfMonth(month);
      
      // Vérifier si le prêt est actif ce mois
      if (monthStart < startOfMonth(startDate)) return sum;
      
      // Calculer le numéro du mois dans le prêt (0-indexed)
      const monthIndex = differenceInMonths(monthStart, startOfMonth(startDate));
      const durationMonths = fin.duration_months || 60;
      
      // Prêt terminé
      if (monthIndex >= durationMonths) return sum;
      
      // Utiliser getLoanScheduleEntry pour le calcul correct des intérêts
      // basé sur le tableau d'amortissement réel
      const entry = getLoanScheduleEntry(
        Number(fin.amount) || 0,
        Number(fin.interest_rate) || 0,
        durationMonths,
        monthIndex
      );
      
      return sum + entry.interest;
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

  // Calculate purchase costs from revenue streams (COGS from products)
  const getPurchaseCostForMonth = (month: Date, revenueType?: 'merchandise' | 'production'): number => {
    return streams.reduce((sum, stream) => {
      if (!stream.has_purchase_cost || !stream.purchase_price) return sum;
      if (revenueType && stream.revenue_type !== revenueType) return sum;
      
      const revenue = getRevenueForecast(stream.id, month);
      const purchaseCost = revenue * (stream.purchase_price / 100);
      
      return sum + purchaseCost;
    }, 0);
  };

  // Get operating grants (subventions d'exploitation - compte 74)
  const getOperatingGrantsForMonth = (month: Date): number => {
    const monthStart = startOfMonth(month);
    return financings.reduce((sum, fin) => {
      if (fin.financing_type !== 'grant') return sum;
      if (fin.is_operating_grant === false) return sum; // Exclude investment grants
      
      const startDate = parseISO(fin.start_date);
      const endDate = fin.end_date ? parseISO(fin.end_date) : null;
      
      if (monthStart < startOfMonth(startDate)) return sum;
      if (endDate && monthStart > startOfMonth(endDate)) return sum;
      
      // Subventions d'exploitation étalées sur la durée
      const durationMonths = fin.duration_months || 12;
      const monthlyAmount = (fin.amount || 0) / durationMonths;
      
      return sum + monthlyAmount;
    }, 0);
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
    // I. PRODUITS D'EXPLOITATION
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'I. PRODUITS D\'EXPLOITATION', type: 'header', values: [], sectionType: 'revenue' });
    
    // Ventes de marchandises (707)
    const merchandiseStreams = streams.filter(s => s.revenue_type === 'merchandise');
    const merchandiseSalesValues = calculateYearlyValues(month => 
      merchandiseStreams.reduce((sum, stream) => sum + getRevenueForecast(stream.id, month), 0)
    );
    
    if (merchandiseSalesValues.some(v => v > 0)) {
      rows.push({ label: 'Ventes de marchandises (707)', type: 'item', values: merchandiseSalesValues, indent: 1, sectionType: 'revenue', pcgCode: '707' });
    }
    
    // Production vendue - Prestations de services (706)
    const productionStreams = streams.filter(s => s.revenue_type !== 'merchandise');
    const productionSoldValues = calculateYearlyValues(month => 
      productionStreams.reduce((sum, stream) => sum + getRevenueForecast(stream.id, month), 0)
    );
    
    if (productionSoldValues.some(v => v > 0)) {
      rows.push({ label: 'Production vendue - Prestations de services (706)', type: 'item', values: productionSoldValues, indent: 1, sectionType: 'revenue', pcgCode: '706' });
    }

    // Subventions d'exploitation (74)
    const operatingGrantsValues = calculateYearlyValues(month => getOperatingGrantsForMonth(month));
    if (operatingGrantsValues.some(v => v > 0)) {
      rows.push({ label: 'Subventions d\'exploitation (74)', type: 'item', values: operatingGrantsValues, indent: 1, sectionType: 'revenue', pcgCode: '74' });
    }

    // Total produits d'exploitation
    const totalRevenueValues = years.map((_, i) => 
      merchandiseSalesValues[i] + productionSoldValues[i] + operatingGrantsValues[i]
    );
    rows.push({ label: 'TOTAL PRODUITS D\'EXPLOITATION (I)', type: 'subtotal', values: totalRevenueValues, sectionType: 'revenue' });

    // ═══════════════════════════════════════════════════════════════
    // II. CHARGES D'EXPLOITATION (Par nature PCG)
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'II. CHARGES D\'EXPLOITATION', type: 'header', values: [], isExpense: true, sectionType: 'expense' });

    // A. Achats (Classe 60)
    
    // Achats de marchandises (607)
    const merchandisePurchasesValues = calculateYearlyValues(month => 
      getPurchaseCostForMonth(month, 'merchandise')
    );
    if (merchandisePurchasesValues.some(v => v > 0)) {
      rows.push({ label: 'Achats de marchandises (607)', type: 'item', values: merchandisePurchasesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '607' });
    }

    // Variation de stocks (603/713) - from useStocks
    const stockVariationValues = years.map((_, yearIndex) => getStockVariation(yearIndex + 1));
    if (stockVariationValues.some(v => v !== 0)) {
      rows.push({ label: 'Variation des stocks (603)', type: 'item', values: stockVariationValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '603' });
    }

    // Achats de matières et fournitures (from streams with purchase cost)
    const purchasesFromProductionValues = calculateYearlyValues(month => 
      getPurchaseCostForMonth(month, 'production')
    );

    // Charges variables COGS (category 'cogs') - ex: frais de transport, frais accessoires d'achat
    const cogsVariableExpensesValues = calculateYearlyValues(month => {
      const revenueByStream = new Map<string | null, { amount: number; units: number }>();
      streams.forEach(stream => {
        const amount = getRevenueForecast(stream.id, month);
        revenueByStream.set(stream.id, { amount, units: 1 });
      });
      return variableExpenses
        .filter(e => e.category === 'cogs')
        .reduce((sum, e) => sum + calculateVariableExpenseForMonth(e, month, revenueByStream), 0);
    });

    // Combined purchases line (601/602) = stream purchase costs + COGS variable expenses
    const totalPurchasesFromProduction = years.map((_, i) => 
      purchasesFromProductionValues[i] + cogsVariableExpensesValues[i]
    );
    if (totalPurchasesFromProduction.some(v => v > 0)) {
      rows.push({ label: 'Achats de matières et fournitures (601/602)', type: 'item', values: totalPurchasesFromProduction, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '601' });
    }

    // B. Services extérieurs (61/62) - Inclut le crédit-bail (612)
    const externalServicesValues = calculateYearlyValues(month => {
      // Fixed expenses that are services (61/62)
      // rent (613), insurance (616), telecom (626), marketing (623), 
      // professional_fees (622), banking (627), travel (625), utilities (606)
      const serviceCategories = ['rent', 'insurance', 'telecom', 'marketing', 'professional_fees', 'banking', 'travel', 'utilities'];
      const servicesTotal = fixedExpenses
        .filter(e => serviceCategories.includes(e.category || ''))
        .reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0);
      
      // Add leasing (credit-bail - 612)
      const leasing = getMonthlyLeasePayments(month);
      
      // Add freelance costs (621 - Personnel extérieur)
      const freelance = getFreelanceCostsForMonth(month);
      
      // Add variable expenses that are services (commission, payment fees)
      const revenueByStream = new Map<string | null, { amount: number; units: number }>();
      streams.forEach(stream => {
        const amount = getRevenueForecast(stream.id, month);
        revenueByStream.set(stream.id, { amount, units: 1 });
      });
      // All non-COGS variable expenses go to Services extérieurs:
      // delivery (6241), commission (622), transaction_fees (627), packaging, other
      const variableServices = variableExpenses
        .filter(e => e.category !== 'cogs')
        .reduce((sum, e) => sum + calculateVariableExpenseForMonth(e, month, revenueByStream), 0);
      
      return servicesTotal + leasing + freelance + variableServices;
    });
    rows.push({ label: 'Autres achats et charges externes (61/62)', type: 'item', values: externalServicesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '61' });

    // C. Impôts, taxes et versements assimilés (63)
    const getPayrollTaxesForMonth = (month: Date) => {
      const rates = URSSAF_RATES_2026.employer;
      const activeEmployees = personnel.filter(p => {
        if (!isPersonnelActiveForMonth(p, month)) return false;
        if (p.worker_type !== 'employee') return false;
        if (p.contract_type === 'internship' || p.contract_type === 'intern') return false;
        return true;
      });
      const grossSalaries = activeEmployees.reduce((sum, p) => sum + (Number(p.gross_salary) || 0), 0);
      const headcount = activeEmployees.length;
      const isSmallCompany = headcount < 11;
      const apprentissage = grossSalaries * rates.apprentissage;
      const formationRate = isSmallCompany ? rates.formation.small : rates.formation.large;
      const formation = grossSalaries * formationRate;
      return apprentissage + formation;
    };

    const taxesValues = calculateYearlyValues(month => {
      const payrollTaxes = getPayrollTaxesForMonth(month);
      const otherTaxes = fixedExpenses
        .filter(e => e.category === 'taxes')
        .reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0);
      return payrollTaxes + otherTaxes;
    });
    if (taxesValues.some(v => v > 0)) {
      rows.push({ label: 'Impôts, taxes et versements assimilés (63)', type: 'item', values: taxesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '63' });
    }

    // D. Charges de personnel (64)
    rows.push({ label: 'Charges de personnel (64)', type: 'header', values: [], isExpense: true, indent: 1, sectionType: 'expense' });
    
    // Calcul des indemnités de départ à intégrer dans les salaires
    const severanceValues = calculateYearlyValues(month => getSeverancePaymentsForMonth(month));
    
    // Salaires et traitements (641) incluant les indemnités de départ
    const grossSalaryValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).grossSalaries);
    const salariesWithSeverance = years.map((_, i) => grossSalaryValues[i] + severanceValues[i]);
    rows.push({ label: 'Salaires et traitements (641)', type: 'item', values: salariesWithSeverance, isExpense: true, indent: 2, sectionType: 'expense', pcgCode: '641' });
    
    const chargesValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).employerCharges);
    rows.push({ label: 'Charges sociales (645)', type: 'item', values: chargesValues, isExpense: true, indent: 2, sectionType: 'expense', pcgCode: '645' });

    const personnelValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).total);
    const totalPersonnelWithSeverance = years.map((_, i) => personnelValues[i] + severanceValues[i]);
    rows.push({ label: 'Total charges de personnel', type: 'subtotal', values: totalPersonnelWithSeverance, isExpense: true, sectionType: 'expense' });

    // Rémunération des dirigeants
    const directorTotalValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).total);

    if (directors.length > 0) {
      rows.push({ label: 'Rémunération dirigeants', type: 'header', values: [], isExpense: true, indent: 1, sectionType: 'expense' });
      const directorRemunerationValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).remuneration);
      const directorChargesValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).charges);
      rows.push({ label: 'Rémunération nette', type: 'item', values: directorRemunerationValues, isExpense: true, indent: 2, sectionType: 'expense' });
      rows.push({ label: 'Charges sociales dirigeants', type: 'item', values: directorChargesValues, isExpense: true, indent: 2, sectionType: 'expense' });
      rows.push({ label: 'Total rémunération dirigeants', type: 'subtotal', values: directorTotalValues, isExpense: true, sectionType: 'expense' });
    }

    // E. Fournitures de bureau et consommables (606)
    const officeSuppliesValues = calculateYearlyValues(month => 
      fixedExpenses
        .filter(e => e.category === 'office')
        .reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0)
    );
    if (officeSuppliesValues.some(v => v > 0)) {
      rows.push({ label: 'Fournitures de bureau (606)', type: 'item', values: officeSuppliesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '606' });
    }

    // F. Autres charges de gestion courante (65)
    const otherExpensesValues = calculateYearlyValues(month => 
      fixedExpenses
        .filter(e => ['software', 'other'].includes(e.category || ''))
        .reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0)
    );
    if (otherExpensesValues.some(v => v > 0)) {
      rows.push({ label: 'Autres charges de gestion courante (65)', type: 'item', values: otherExpensesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '65' });
    }

    // G. Dotations aux amortissements (68)
    const depreciationValues = calculateYearlyValues(month => getDepreciationForMonth(month));
    if (depreciationValues.some(v => v > 0)) {
      rows.push({ label: 'Dotations aux amortissements (68)', type: 'item', values: depreciationValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '68' });
    }

    // ═══════════════════════════════════════════════════════════════
    // CALCUL DES SIG (Soldes Intermédiaires de Gestion)
    // ═══════════════════════════════════════════════════════════════

    // Marge Commerciale = Ventes marchandises - Coût d'achat marchandises - Variation stocks marchandises
    const commercialMarginValues = years.map((_, i) => 
      merchandiseSalesValues[i] - merchandisePurchasesValues[i] - stockVariationValues[i]
    );
    
    if (merchandiseSalesValues.some(v => v > 0)) {
      rows.push({ label: 'MARGE COMMERCIALE', type: 'sig', values: commercialMarginValues, sectionType: 'result', isSIG: true });
    }

    // Production de l'exercice (pour l'instant = Production vendue)
    const productionValues = productionSoldValues;

    // Valeur Ajoutée = Marge commerciale + Production - Consommations en provenance des tiers (60/61/62)
    // Consommations = Achats (60) + Services extérieurs (61/62) + Fournitures (606)
    const externalConsumptionValues = years.map((_, i) => 
      totalPurchasesFromProduction[i] + externalServicesValues[i] + officeSuppliesValues[i]
    );
    
    const valueAddedValues = years.map((_, i) => 
      commercialMarginValues[i] + productionValues[i] - externalConsumptionValues[i]
    );
    rows.push({ label: 'VALEUR AJOUTÉE', type: 'sig', values: valueAddedValues, sectionType: 'result', isSIG: true });

    // Excédent Brut d'Exploitation (EBE) = VA + Subventions (74) - Impôts (63) - Personnel (64)
    const ebeValues = years.map((_, i) => 
      valueAddedValues[i] + operatingGrantsValues[i] - taxesValues[i] - totalPersonnelWithSeverance[i] - directorTotalValues[i]
    );
    rows.push({ label: 'EXCÉDENT BRUT D\'EXPLOITATION (EBE)', type: 'sig', values: ebeValues, sectionType: 'result', isSIG: true });

    // Total charges d'exploitation (pour référence)
    const totalExpenseValues = years.map((_, i) => 
      merchandisePurchasesValues[i] + stockVariationValues[i] + totalPurchasesFromProduction[i] + 
      externalServicesValues[i] + officeSuppliesValues[i] + taxesValues[i] + totalPersonnelWithSeverance[i] + directorTotalValues[i] + 
      otherExpensesValues[i] + depreciationValues[i]
    );
    rows.push({ label: 'TOTAL CHARGES D\'EXPLOITATION (II)', type: 'subtotal', values: totalExpenseValues, isExpense: true, sectionType: 'expense' });

    // ═══════════════════════════════════════════════════════════════
    // RÉSULTAT D'EXPLOITATION (I - II) = EBE - Amortissements - Autres charges
    // ═══════════════════════════════════════════════════════════════
    const operatingResultValues = years.map((_, i) => 
      ebeValues[i] - depreciationValues[i] - otherExpensesValues[i]
    );
    rows.push({ label: 'RÉSULTAT D\'EXPLOITATION (I - II)', type: 'sig', values: operatingResultValues, sectionType: 'result' });

    // ═══════════════════════════════════════════════════════════════
    // III. PRODUITS FINANCIERS
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'III. PRODUITS FINANCIERS', type: 'header', values: [], sectionType: 'revenue' });
    
    const financialRevenueValues = years.map(() => 0);
    rows.push({ label: 'Intérêts et produits assimilés', type: 'item', values: financialRevenueValues, indent: 1, sectionType: 'revenue' });
    rows.push({ label: 'TOTAL PRODUITS FINANCIERS (III)', type: 'subtotal', values: financialRevenueValues, sectionType: 'revenue' });

    // ═══════════════════════════════════════════════════════════════
    // IV. CHARGES FINANCIÈRES
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'IV. CHARGES FINANCIÈRES', type: 'header', values: [], isExpense: true, sectionType: 'expense' });
    
    const interestExpenseValues = calculateYearlyValues(month => getMonthlyInterestExpense(month));
    if (interestExpenseValues.some(v => v > 0)) {
      rows.push({ label: 'Intérêts et charges assimilées (66)', type: 'item', values: interestExpenseValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '66' });
    }
    
    rows.push({ label: 'TOTAL CHARGES FINANCIÈRES (IV)', type: 'subtotal', values: interestExpenseValues, isExpense: true, sectionType: 'expense' });

    // ═══════════════════════════════════════════════════════════════
    // RÉSULTAT FINANCIER (III - IV)
    // ═══════════════════════════════════════════════════════════════
    const financialResultValues = years.map((_, i) => financialRevenueValues[i] - interestExpenseValues[i]);
    rows.push({ label: 'RÉSULTAT FINANCIER (III - IV)', type: 'sig', values: financialResultValues, sectionType: 'result' });

    // ═══════════════════════════════════════════════════════════════
    // V. PRODUITS EXCEPTIONNELS
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'V. PRODUITS EXCEPTIONNELS', type: 'header', values: [], sectionType: 'revenue' });
    
    const exceptionalRevenueValues = years.map(() => 0);
    rows.push({ label: 'Produits exceptionnels', type: 'item', values: exceptionalRevenueValues, indent: 1, sectionType: 'revenue' });
    rows.push({ label: 'TOTAL PRODUITS EXCEPTIONNELS (V)', type: 'subtotal', values: exceptionalRevenueValues, sectionType: 'revenue' });

    // ═══════════════════════════════════════════════════════════════
    // VI. CHARGES EXCEPTIONNELLES
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'VI. CHARGES EXCEPTIONNELLES', type: 'header', values: [], isExpense: true, sectionType: 'expense' });
    
    const exceptionalExpenseValues = years.map(() => 0);
    rows.push({ label: 'Charges exceptionnelles', type: 'item', values: exceptionalExpenseValues, isExpense: true, indent: 1, sectionType: 'expense' });
    rows.push({ label: 'TOTAL CHARGES EXCEPTIONNELLES (VI)', type: 'subtotal', values: exceptionalExpenseValues, isExpense: true, sectionType: 'expense' });

    // ═══════════════════════════════════════════════════════════════
    // RÉSULTAT EXCEPTIONNEL (V - VI)
    // ═══════════════════════════════════════════════════════════════
    const exceptionalResultValues = years.map((_, i) => exceptionalRevenueValues[i] - exceptionalExpenseValues[i]);
    rows.push({ label: 'RÉSULTAT EXCEPTIONNEL (V - VI)', type: 'sig', values: exceptionalResultValues, sectionType: 'result' });

    // ═══════════════════════════════════════════════════════════════
    // RÉSULTAT COURANT AVANT IMPÔTS
    // ═══════════════════════════════════════════════════════════════
    const rcaiValues = years.map((_, i) => operatingResultValues[i] + financialResultValues[i] + exceptionalResultValues[i]);
    const rcaiPercentOfRevenue = years.map((_, i) => {
      const rev = merchandiseSalesValues[i] + productionSoldValues[i];
      return rev > 0 ? (rcaiValues[i] / rev) * 100 : 0;
    });
    rows.push({ label: 'RÉSULTAT COURANT AVANT IMPÔTS', type: 'sig', values: rcaiValues, sectionType: 'result', percentOfRevenue: rcaiPercentOfRevenue });

    // ═══════════════════════════════════════════════════════════════
    // IMPÔT SUR LES BÉNÉFICES (69)
    // ═══════════════════════════════════════════════════════════════
    const taxRegime = (settings.tax_regime || 'is') as TaxRegime;
    const isPME = settings.is_pme !== false;
    
    const revenueValues = years.map((_, i) => merchandiseSalesValues[i] + productionSoldValues[i]);
    
    const corporateTaxValues = years.map((_, i) => {
      const yearResult = rcaiValues[i];
      const yearRevenue = revenueValues[i];
      const taxResult = calculateTaxByRegime(Math.max(0, yearResult), taxRegime, {
        isPME,
        activityType: 'services',
        chiffreAffaires: yearRevenue,
      });
      return taxResult.tax;
    });
    
    const taxLabel = taxRegime === 'is' ? 'Impôt sur les sociétés (69)' : taxRegime === 'ir' ? 'Impôt sur le revenu' : 'Impôt (micro-entreprise)';
    rows.push({ label: taxLabel, type: 'item', values: corporateTaxValues, isExpense: true, sectionType: 'expense', pcgCode: '69' });

    // ═══════════════════════════════════════════════════════════════
    // RÉSULTAT NET DE L'EXERCICE
    // ═══════════════════════════════════════════════════════════════
    const netResultValues = years.map((_, i) => rcaiValues[i] - corporateTaxValues[i]);
    rows.push({ label: 'RÉSULTAT NET DE L\'EXERCICE', type: 'total', values: netResultValues, sectionType: 'result' });

    // TVA calculations
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

    // Legacy values for backward compatibility
    const legacyCogs = years.map((_, i) => merchandisePurchasesValues[i] + stockVariationValues[i] + totalPurchasesFromProduction[i]);
    const legacyFixedExpenses = calculateYearlyValues(month => 
      fixedExpenses.reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0)
    );
    const legacyVariableExpenses = calculateYearlyValues(month => {
      const revenueByStream = new Map<string | null, { amount: number; units: number }>();
      streams.forEach(stream => {
        const amount = getRevenueForecast(stream.id, month);
        revenueByStream.set(stream.id, { amount, units: 1 });
      });
      return variableExpenses.reduce((sum, e) => sum + calculateVariableExpenseForMonth(e, month, revenueByStream), 0);
    });
    const legacyLeaseValues = calculateYearlyValues(month => getMonthlyLeasePayments(month));
    const legacyPayrollTaxes = calculateYearlyValues(month => getPayrollTaxesForMonth(month));

    return {
      years,
      rows,
      totals: {
        // New PCG structure
        merchandiseSales: merchandiseSalesValues,
        productionSold: productionSoldValues,
        operatingGrants: operatingGrantsValues,
        revenue: revenueValues,
        
        merchandisePurchases: merchandisePurchasesValues,
        stockVariation: stockVariationValues,
        externalServices: externalServicesValues,
        taxes: taxesValues,
        personnel: totalPersonnelWithSeverance,
        depreciation: depreciationValues,
        
        // SIG
        commercialMargin: commercialMarginValues,
        valueAdded: valueAddedValues,
        ebitda: ebeValues,
        operatingResult: operatingResultValues,
        financialResult: financialResultValues,
        netResultBeforeTax: rcaiValues,
        corporateTax: corporateTaxValues,
        netResult: netResultValues,
        
        // Legacy (backward compatibility)
        cogs: legacyCogs,
        fixedExpenses: legacyFixedExpenses,
        variableExpenses: legacyVariableExpenses,
        personnelCosts: totalPersonnelWithSeverance,
        directorsCosts: directorTotalValues,
        leaseExpenses: legacyLeaseValues,
        payrollTaxes: legacyPayrollTaxes,
        severancePayments: severanceValues,
      },
      tva: {
        collected: tvaCollectedValues,
        deductible: tvaDeductibleValues,
        balance: tvaBalanceValues,
      },
    };
  }, [streams, fixedExpenses, variableExpenses, personnel, directors, investments, financings, forecasts, settings, getStockVariation]);

  const getBreakEvenYear = (): number | null => {
    let cumulative = 0;
    for (let i = 0; i < data.totals.netResult.length; i++) {
      cumulative += data.totals.netResult[i];
      if (cumulative > 0) return i + 1;
    }
    return null;
  };

  // Calculate gross margin for a specific year
  const getGrossMargin = (yearIndex: number = 0): number => {
    const revenue = data.totals.revenue[yearIndex] || 0;
    const cogs = data.totals.cogs[yearIndex] || 0;
    return revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
  };

  // Calculate EBITDA (EBE) margin for a specific year
  const getEBITDAMargin = (yearIndex: number = 0): number => {
    const revenue = data.totals.revenue[yearIndex] || 0;
    const ebitda = data.totals.ebitda[yearIndex] || 0;
    return revenue > 0 ? (ebitda / revenue) * 100 : 0;
  };

  // Calculate Value Added margin for a specific year
  const getValueAddedMargin = (yearIndex: number = 0): number => {
    const revenue = data.totals.revenue[yearIndex] || 0;
    const va = data.totals.valueAdded[yearIndex] || 0;
    return revenue > 0 ? (va / revenue) * 100 : 0;
  };

  return {
    data,
    isLoading,
    getBreakEvenYear,
    getGrossMargin,
    getEBITDAMargin,
    getValueAddedMargin,
  };
}
