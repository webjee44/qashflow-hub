// ============================================================
// computePL — pure Profit & Loss computation
// ============================================================
// Lifted verbatim from useProfitLoss.ts (PR 1: parity, no fix).
// Same inputs → same outputs. Any financial correction lives in PR 2.
// ============================================================

import { startOfMonth, addMonths, parseISO, format, differenceInMonths } from 'date-fns';
import {
  calculateTaxByRegime,
  TVA_RATES_FR,
  TaxRegime,
  URSSAF_RATES_2026,
  SEVERANCE_FORFAIT_SOCIAL,
  getLoanScheduleEntry,
} from '@/lib/french-rates';
import { PAYMENT_FREQUENCIES, DEPARTURE_TYPES } from '@/constants/bpConstants';
import { normalizeRate } from '@/lib/rateUtils';
import type { BPModelInput } from './types';
import type { PLData, PLRow, FiscalYear } from '../hooks/useProfitLoss';

// Stock variation helper — same formula as useStocks.getStockVariation
function makeGetStockVariation(stocks: any[]) {
  return (fiscalYear: number): number => {
    const yearStocks = stocks.filter(s => s.fiscal_year === fiscalYear);
    return yearStocks.reduce((sum, s) => {
      return sum + Number(s.initial_stock) + Number(s.purchase_amount) - Number(s.final_stock);
    }, 0);
  };
}

export function computePL(input: BPModelInput): PLData {
  const {
    settings,
    streams,
    forecasts,
    fixedExpenses,
    variableExpenses,
    personnel,
    directors,
    investments,
    financings,
    stocks,
  } = input;

  const getStockVariation = makeGetStockVariation(stocks);

  // ── Helpers (copied verbatim from useProfitLoss) ──

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
      const rate = normalizeRate(p.employer_charges_rate);
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
      const rate = normalizeRate(d.charges_rate);
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
      const growthPct = normalizeRate(stream.growth_rate, 0.10);
      const churnPct = normalizeRate(stream.churn_rate, 0.05);
      const netGrowth = growthPct - churnPct;
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
      let growthRate = normalizeRate(stream.growth_rate, 0);
      if (y === 1) growthRate = normalizeRate(stream.growth_rate_year2 ?? stream.growth_rate, 0);
      else if (y === 2) growthRate = normalizeRate(stream.growth_rate_year3 ?? stream.growth_rate, 0);
      else growthRate = normalizeRate(stream.growth_rate_year4 ?? stream.growth_rate, 0);
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
      if (monthStart < startOfMonth(startDate)) return sum;
      const monthIndex = differenceInMonths(monthStart, startOfMonth(startDate));
      const durationMonths = fin.duration_months || 60;
      if (monthIndex >= durationMonths) return sum;
      const entry = getLoanScheduleEntry(
        Number(fin.amount) || 0,
        Number(fin.interest_rate) || 0,
        durationMonths,
        monthIndex
      );
      return sum + entry.interest;
    }, 0);
  };

  const calculateVariableExpenseForMonth = (
    expense: any,
    month: Date,
    revenueByStream: Map<string | null, { amount: number; units: number }>
  ): number => {
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

  const getPurchaseCostForMonth = (month: Date, revenueType?: 'merchandise' | 'production'): number => {
    return streams.reduce((sum, stream) => {
      if (!stream.has_purchase_cost || !stream.purchase_price) return sum;
      if (revenueType && stream.revenue_type !== revenueType) return sum;
      const revenue = getRevenueForecast(stream.id, month);
      const purchaseCost = revenue * (stream.purchase_price / 100);
      return sum + purchaseCost;
    }, 0);
  };

  const getOperatingGrantsForMonth = (month: Date): number => {
    const monthStart = startOfMonth(month);
    return financings.reduce((sum, fin) => {
      if (fin.financing_type !== 'grant') return sum;
      if (fin.is_operating_grant === false) return sum;
      const startDate = parseISO(fin.start_date);
      const endDate = fin.end_date ? parseISO(fin.end_date) : null;
      if (monthStart < startOfMonth(startDate)) return sum;
      if (endDate && monthStart > startOfMonth(endDate)) return sum;
      const durationMonths = fin.duration_months || 12;
      const monthlyAmount = (fin.amount || 0) / durationMonths;
      return sum + monthlyAmount;
    }, 0);
  };

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

  // ── Build P&L (verbatim from useProfitLoss useMemo) ──

  const years = getFiscalYears();

  const calculateYearlyValues = (getMonthValue: (month: Date) => number): number[] => {
    return years.map(year => year.months.reduce((sum, month) => sum + getMonthValue(month), 0));
  };

  const rows: PLRow[] = [];

  rows.push({ label: 'I. PRODUITS D\'EXPLOITATION', type: 'header', values: [], sectionType: 'revenue' });

  // Lot 2.8 — PCG mapping by revenue_type (single source of truth)
  // 707 marchandises | 701 production de biens | 706 prestations de services
  // subscription routed to 706 by default (configurable later via revenue_type)
  const sumStreams = (predicate: (s: any) => boolean) =>
    calculateYearlyValues(month =>
      streams.filter(predicate).reduce((sum, stream) => sum + getRevenueForecast(stream.id, month), 0)
    );

  const merchandiseSalesValues = sumStreams(s => s.revenue_type === 'merchandise');
  if (merchandiseSalesValues.some(v => v > 0)) {
    rows.push({ label: 'Ventes de marchandises (707)', type: 'item', values: merchandiseSalesValues, indent: 1, sectionType: 'revenue', pcgCode: '707' });
  }

  const productionGoodsValues = sumStreams(s => s.revenue_type === 'production');
  if (productionGoodsValues.some(v => v > 0)) {
    rows.push({ label: 'Production vendue - Biens (701)', type: 'item', values: productionGoodsValues, indent: 1, sectionType: 'revenue', pcgCode: '701' });
  }

  const servicesValues = sumStreams(s =>
    s.revenue_type !== 'merchandise' && s.revenue_type !== 'production'
  );
  if (servicesValues.some(v => v > 0)) {
    rows.push({ label: 'Production vendue - Prestations de services (706)', type: 'item', values: servicesValues, indent: 1, sectionType: 'revenue', pcgCode: '706' });
  }

  const operatingGrantsValues = calculateYearlyValues(month => getOperatingGrantsForMonth(month));
  if (operatingGrantsValues.some(v => v > 0)) {
    rows.push({ label: 'Subventions d\'exploitation (74)', type: 'item', values: operatingGrantsValues, indent: 1, sectionType: 'revenue', pcgCode: '74' });
  }

  const totalRevenueValues = years.map((_, i) =>
    merchandiseSalesValues[i] + productionGoodsValues[i] + servicesValues[i] + operatingGrantsValues[i]
  );
  rows.push({ label: 'TOTAL PRODUITS D\'EXPLOITATION (I)', type: 'subtotal', values: totalRevenueValues, sectionType: 'revenue' });

  rows.push({ label: 'II. CHARGES D\'EXPLOITATION', type: 'header', values: [], isExpense: true, sectionType: 'expense' });

  const merchandisePurchasesValues = calculateYearlyValues(month =>
    getPurchaseCostForMonth(month, 'merchandise')
  );
  if (merchandisePurchasesValues.some(v => v > 0)) {
    rows.push({ label: 'Achats de marchandises (607)', type: 'item', values: merchandisePurchasesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '607' });
  }

  const stockVariationValues = years.map((_, yearIndex) => getStockVariation(yearIndex + 1));
  if (stockVariationValues.some(v => v !== 0)) {
    rows.push({ label: 'Variation des stocks (603)', type: 'item', values: stockVariationValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '603' });
  }

  const purchasesFromProductionValues = calculateYearlyValues(month =>
    getPurchaseCostForMonth(month, 'production')
  );

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

  const totalPurchasesFromProduction = years.map((_, i) =>
    purchasesFromProductionValues[i] + cogsVariableExpensesValues[i]
  );
  if (totalPurchasesFromProduction.some(v => v > 0)) {
    rows.push({ label: 'Achats de matières et fournitures (601/602)', type: 'item', values: totalPurchasesFromProduction, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '601' });
  }

  const externalServicesValues = calculateYearlyValues(month => {
    const serviceCategories = ['rent', 'insurance', 'telecom', 'marketing', 'professional_fees', 'banking', 'travel', 'utilities', 'services'];
    const servicesTotal = fixedExpenses
      .filter(e => serviceCategories.includes(e.category || ''))
      .reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0);
    const leasing = getMonthlyLeasePayments(month);
    const freelance = getFreelanceCostsForMonth(month);
    const revenueByStream = new Map<string | null, { amount: number; units: number }>();
    streams.forEach(stream => {
      const amount = getRevenueForecast(stream.id, month);
      revenueByStream.set(stream.id, { amount, units: 1 });
    });
    const variableServices = variableExpenses
      .filter(e => e.category !== 'cogs')
      .reduce((sum, e) => sum + calculateVariableExpenseForMonth(e, month, revenueByStream), 0);
    return servicesTotal + leasing + freelance + variableServices;
  });
  rows.push({ label: 'Autres achats et charges externes (61/62)', type: 'item', values: externalServicesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '61' });

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

  rows.push({ label: 'Charges de personnel (64)', type: 'header', values: [], isExpense: true, indent: 1, sectionType: 'expense' });

  const severanceValues = calculateYearlyValues(month => getSeverancePaymentsForMonth(month));
  const grossSalaryValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).grossSalaries);
  const salariesWithSeverance = years.map((_, i) => grossSalaryValues[i] + severanceValues[i]);
  rows.push({ label: 'Salaires et traitements (641)', type: 'item', values: salariesWithSeverance, isExpense: true, indent: 2, sectionType: 'expense', pcgCode: '641' });

  const chargesValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).employerCharges);
  rows.push({ label: 'Charges sociales (645)', type: 'item', values: chargesValues, isExpense: true, indent: 2, sectionType: 'expense', pcgCode: '645' });

  const personnelValues = calculateYearlyValues(month => getPersonnelBreakdownForMonth(month).total);
  const totalPersonnelWithSeverance = years.map((_, i) => personnelValues[i] + severanceValues[i]);
  rows.push({ label: 'Total charges de personnel', type: 'subtotal', values: totalPersonnelWithSeverance, isExpense: true, sectionType: 'expense' });

  const directorTotalValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).total);
  if (directors.length > 0) {
    rows.push({ label: 'Rémunération dirigeants', type: 'header', values: [], isExpense: true, indent: 1, sectionType: 'expense' });
    const directorRemunerationValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).remuneration);
    const directorChargesValues = calculateYearlyValues(month => getDirectorsBreakdownForMonth(month).charges);
    rows.push({ label: 'Rémunération nette', type: 'item', values: directorRemunerationValues, isExpense: true, indent: 2, sectionType: 'expense' });
    rows.push({ label: 'Charges sociales dirigeants', type: 'item', values: directorChargesValues, isExpense: true, indent: 2, sectionType: 'expense' });
    rows.push({ label: 'Total rémunération dirigeants', type: 'subtotal', values: directorTotalValues, isExpense: true, sectionType: 'expense' });
  }

  const officeSuppliesValues = calculateYearlyValues(month =>
    fixedExpenses.filter(e => e.category === 'office').reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0)
  );
  if (officeSuppliesValues.some(v => v > 0)) {
    rows.push({ label: 'Fournitures de bureau (606)', type: 'item', values: officeSuppliesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '606' });
  }

  const otherExpensesValues = calculateYearlyValues(month =>
    fixedExpenses.filter(e => ['software', 'other'].includes(e.category || '')).reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0)
  );
  if (otherExpensesValues.some(v => v > 0)) {
    rows.push({ label: 'Autres charges de gestion courante (65)', type: 'item', values: otherExpensesValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '65' });
  }

  const depreciationValues = calculateYearlyValues(month => getDepreciationForMonth(month));
  if (depreciationValues.some(v => v > 0)) {
    rows.push({ label: 'Dotations aux amortissements (68)', type: 'item', values: depreciationValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '68' });
  }

  const commercialMarginValues = years.map((_, i) =>
    merchandiseSalesValues[i] - merchandisePurchasesValues[i] - stockVariationValues[i]
  );
  if (merchandiseSalesValues.some(v => v > 0)) {
    rows.push({ label: 'MARGE COMMERCIALE', type: 'sig', values: commercialMarginValues, sectionType: 'result', isSIG: true });
  }

  const productionValues = servicesValues;
  const externalConsumptionValues = years.map((_, i) =>
    totalPurchasesFromProduction[i] + externalServicesValues[i] + officeSuppliesValues[i]
  );
  const valueAddedValues = years.map((_, i) =>
    commercialMarginValues[i] + productionValues[i] - externalConsumptionValues[i]
  );
  rows.push({ label: 'VALEUR AJOUTÉE', type: 'sig', values: valueAddedValues, sectionType: 'result', isSIG: true });

  const ebeValues = years.map((_, i) =>
    valueAddedValues[i] + operatingGrantsValues[i] - taxesValues[i] - totalPersonnelWithSeverance[i] - directorTotalValues[i]
  );
  rows.push({ label: 'EXCÉDENT BRUT D\'EXPLOITATION (EBE)', type: 'sig', values: ebeValues, sectionType: 'result', isSIG: true });

  const totalExpenseValues = years.map((_, i) =>
    merchandisePurchasesValues[i] + stockVariationValues[i] + totalPurchasesFromProduction[i] +
    externalServicesValues[i] + officeSuppliesValues[i] + taxesValues[i] + totalPersonnelWithSeverance[i] + directorTotalValues[i] +
    otherExpensesValues[i] + depreciationValues[i]
  );
  rows.push({ label: 'TOTAL CHARGES D\'EXPLOITATION (II)', type: 'subtotal', values: totalExpenseValues, isExpense: true, sectionType: 'expense' });

  const operatingResultValues = years.map((_, i) =>
    ebeValues[i] - depreciationValues[i] - otherExpensesValues[i]
  );
  rows.push({ label: 'RÉSULTAT D\'EXPLOITATION (I - II)', type: 'sig', values: operatingResultValues, sectionType: 'result' });

  rows.push({ label: 'III. PRODUITS FINANCIERS', type: 'header', values: [], sectionType: 'revenue' });
  const financialRevenueValues = years.map(() => 0);
  rows.push({ label: 'Intérêts et produits assimilés', type: 'item', values: financialRevenueValues, indent: 1, sectionType: 'revenue' });
  rows.push({ label: 'TOTAL PRODUITS FINANCIERS (III)', type: 'subtotal', values: financialRevenueValues, sectionType: 'revenue' });

  rows.push({ label: 'IV. CHARGES FINANCIÈRES', type: 'header', values: [], isExpense: true, sectionType: 'expense' });
  const interestExpenseValues = calculateYearlyValues(month => getMonthlyInterestExpense(month));
  if (interestExpenseValues.some(v => v > 0)) {
    rows.push({ label: 'Intérêts et charges assimilées (66)', type: 'item', values: interestExpenseValues, isExpense: true, indent: 1, sectionType: 'expense', pcgCode: '66' });
  }
  rows.push({ label: 'TOTAL CHARGES FINANCIÈRES (IV)', type: 'subtotal', values: interestExpenseValues, isExpense: true, sectionType: 'expense' });

  const financialResultValues = years.map((_, i) => financialRevenueValues[i] - interestExpenseValues[i]);
  rows.push({ label: 'RÉSULTAT FINANCIER (III - IV)', type: 'sig', values: financialResultValues, sectionType: 'result' });

  rows.push({ label: 'V. PRODUITS EXCEPTIONNELS', type: 'header', values: [], sectionType: 'revenue' });
  const exceptionalRevenueValues = years.map(() => 0);
  rows.push({ label: 'Produits exceptionnels', type: 'item', values: exceptionalRevenueValues, indent: 1, sectionType: 'revenue' });
  rows.push({ label: 'TOTAL PRODUITS EXCEPTIONNELS (V)', type: 'subtotal', values: exceptionalRevenueValues, sectionType: 'revenue' });

  rows.push({ label: 'VI. CHARGES EXCEPTIONNELLES', type: 'header', values: [], isExpense: true, sectionType: 'expense' });
  const exceptionalExpenseValues = years.map(() => 0);
  rows.push({ label: 'Charges exceptionnelles', type: 'item', values: exceptionalExpenseValues, isExpense: true, indent: 1, sectionType: 'expense' });
  rows.push({ label: 'TOTAL CHARGES EXCEPTIONNELLES (VI)', type: 'subtotal', values: exceptionalExpenseValues, isExpense: true, sectionType: 'expense' });

  const exceptionalResultValues = years.map((_, i) => exceptionalRevenueValues[i] - exceptionalExpenseValues[i]);
  rows.push({ label: 'RÉSULTAT EXCEPTIONNEL (V - VI)', type: 'sig', values: exceptionalResultValues, sectionType: 'result' });

  const rcaiValues = years.map((_, i) => operatingResultValues[i] + financialResultValues[i] + exceptionalResultValues[i]);
  const rcaiPercentOfRevenue = years.map((_, i) => {
    const rev = merchandiseSalesValues[i] + servicesValues[i];
    return rev > 0 ? (rcaiValues[i] / rev) * 100 : 0;
  });
  rows.push({ label: 'RÉSULTAT COURANT AVANT IMPÔTS', type: 'sig', values: rcaiValues, sectionType: 'result', percentOfRevenue: rcaiPercentOfRevenue });

  // Lot 2.7 — Cohérence IR / IS / micro
  // En IR, l'imposition est portée par les associés (fiscalité personnelle).
  // Elle ne doit PAS apparaître au compte de résultat de la société.
  // En micro, idem — le versement libératoire est personnel.
  // Seul l'IS apparaît au P&L (compte 69).
  const taxRegime = (settings.tax_regime || 'is') as TaxRegime;
  const isPME = settings.is_pme !== false;
  const revenueValues = years.map((_, i) => merchandiseSalesValues[i] + servicesValues[i]);
  const corporateTaxValues = years.map((_, i) => {
    if (taxRegime !== 'is') return 0;
    const yearResult = rcaiValues[i];
    const yearRevenue = revenueValues[i];
    const taxResult = calculateTaxByRegime(Math.max(0, yearResult), taxRegime, {
      isPME,
      activityType: 'services',
      chiffreAffaires: yearRevenue,
    });
    return taxResult.tax;
  });
  if (taxRegime === 'is') {
    rows.push({ label: 'Impôt sur les sociétés (69)', type: 'item', values: corporateTaxValues, isExpense: true, sectionType: 'expense', pcgCode: '69' });
  } else {
    const note = taxRegime === 'ir'
      ? "Régime IR — fiscalité personnelle des associés (hors résultat société)"
      : "Régime micro-entreprise — versement libératoire personnel (hors résultat société)";
    rows.push({ label: note, type: 'item', values: years.map(() => 0), sectionType: 'expense' });
  }

  const netResultValues = years.map((_, i) => rcaiValues[i] - corporateTaxValues[i]);
  rows.push({ label: 'RÉSULTAT NET DE L\'EXERCICE', type: 'total', values: netResultValues, sectionType: 'result' });

  // TVA
  const tvaCollectedValues = calculateYearlyValues(month =>
    streams.reduce((sum, stream) => {
      const revenue = getRevenueForecast(stream.id, month);
      const vatRate = stream.vat_rate ?? TVA_RATES_FR.standard;
      return sum + (revenue * vatRate);
    }, 0)
  );
  const tvaDeductibleValues = calculateYearlyValues(month =>
    fixedExpenses.reduce((sum, expense) => {
      const expenseAmount = getFixedExpenseForMonth(expense, month);
      const vatRate = expense.vat_rate ?? TVA_RATES_FR.standard;
      const isDeductible = expense.is_vat_deductible !== false;
      return sum + (isDeductible ? expenseAmount * vatRate : 0);
    }, 0)
  );
  const tvaBalanceValues = years.map((_, i) => tvaCollectedValues[i] - tvaDeductibleValues[i]);

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
      merchandiseSales: merchandiseSalesValues,
      productionSold: servicesValues,
      operatingGrants: operatingGrantsValues,
      revenue: revenueValues,
      merchandisePurchases: merchandisePurchasesValues,
      stockVariation: stockVariationValues,
      externalServices: externalServicesValues,
      taxes: taxesValues,
      personnel: totalPersonnelWithSeverance,
      depreciation: depreciationValues,
      commercialMargin: commercialMarginValues,
      valueAdded: valueAddedValues,
      ebitda: ebeValues,
      operatingResult: operatingResultValues,
      financialResult: financialResultValues,
      netResultBeforeTax: rcaiValues,
      corporateTax: corporateTaxValues,
      netResult: netResultValues,
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
}
