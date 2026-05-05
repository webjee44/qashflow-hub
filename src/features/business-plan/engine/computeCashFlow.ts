// ============================================================
// computeCashFlow — pure (parity with src/hooks/useBPCashFlow)
// ============================================================
// Lifted verbatim from useBPCashFlow's useMemo body. Same inputs,
// same outputs as today's UI. PR 2 will fix the financial gaps
// (P&L vs cash flow reconciliation, VAT timing, etc.).
// ============================================================

import {
  parseISO, startOfMonth, format, isSameMonth, isAfter, isBefore, endOfMonth, addMonths,
} from 'date-fns';
import type { BPModelInput } from './types';
import type { PLData } from '../hooks/useProfitLoss.types';
import type { CashFlowData, CashFlowMonthData } from './types';

function getDaysToMonths(days: number): number {
  if (days <= 15) return 0;
  if (days <= 45) return 1;
  if (days <= 75) return 2;
  return Math.round(days / 30);
}

function isFinancingActiveInMonth(financing: any, month: Date): boolean {
  const startDate = parseISO(financing.start_date);
  const endDate = financing.end_date
    ? parseISO(financing.end_date)
    : addMonths(startDate, financing.duration_months || 60);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  return !isAfter(startDate, monthEnd) && !isBefore(endDate, monthStart);
}

function isPersonActiveInMonth(person: any, month: Date): boolean {
  const monthStart = startOfMonth(month);
  const startDate = parseISO(person.start_date);
  const endDate = person.end_date ? parseISO(person.end_date) : null;
  if (monthStart < startOfMonth(startDate)) return false;
  if (endDate && monthStart > startOfMonth(endDate)) return false;
  return true;
}

export function computeCashFlow(input: BPModelInput, plData: PLData): CashFlowData {
  const { settings, financings, investments, directors } = input;
  const months = plData.years.flatMap(year => year.months);
  const customerDelay = getDaysToMonths(settings.customer_payment_delay || 30);
  const supplierDelay = getDaysToMonths(settings.supplier_payment_delay || 30);
  const initialCash = Number(settings.initial_cash) || 0;
  const showFinancing = settings.show_financing !== false;

  // Build monthly P&L distribution (yearly evenly split — matches useBPCashFlow)
  const monthlyPLData: Array<{
    revenue: number; fixedExpenses: number; variableExpenses: number;
    personnelCosts: number; directorsCosts: number; payrollTaxes: number;
    vatBalance: number; corporateTax: number;
  }> = [];

  plData.years.forEach((year, yearIndex) => {
    const monthCount = year.months.length;
    const yearRevenue = plData.totals.revenue[yearIndex] || 0;
    const yearFixed = plData.totals.fixedExpenses[yearIndex] || 0;
    const yearVariable = plData.totals.variableExpenses[yearIndex] || 0;
    const yearPersonnel = plData.totals.personnelCosts[yearIndex] || 0;
    const yearDirectors = plData.totals.directorsCosts[yearIndex] || 0;
    const yearPayrollTaxes = plData.totals.payrollTaxes[yearIndex] || 0;
    const yearVATBalance = plData.tva.balance[yearIndex] || 0;
    const yearCorporateTax = plData.totals.corporateTax[yearIndex] || 0;
    for (let i = 0; i < monthCount; i++) {
      monthlyPLData.push({
        revenue: yearRevenue / monthCount,
        fixedExpenses: yearFixed / monthCount,
        variableExpenses: yearVariable / monthCount,
        personnelCosts: yearPersonnel / monthCount,
        directorsCosts: yearDirectors / monthCount,
        payrollTaxes: yearPayrollTaxes / monthCount,
        vatBalance: yearVATBalance / monthCount,
        corporateTax: yearCorporateTax / 12,
      });
    }
  });

  const getInvestmentCashOutForMonth = (month: Date): number =>
    investments.reduce((sum, inv) => {
      const purchaseDate = parseISO(inv.purchase_date);
      if (isSameMonth(startOfMonth(month), startOfMonth(purchaseDate))) {
        return sum + (Number(inv.purchase_amount) || 0);
      }
      return sum;
    }, 0);

  const getCapitalContributionsForMonth = (month: Date): number => {
    if (!showFinancing) return 0;
    return financings
      .filter(f => {
        const nameLC = f.name?.toLowerCase() || '';
        return nameLC.includes('capital') || nameLC.includes('apport');
      })
      .reduce((sum, f) => {
        const startDate = parseISO(f.start_date);
        if (isSameMonth(startOfMonth(month), startOfMonth(startDate))) {
          return sum + Number(f.amount);
        }
        return sum;
      }, 0);
  };

  const getCurrentAccountContributionsForMonth = (month: Date): number => {
    if (!showFinancing) return 0;
    return financings
      .filter(f => f.financing_type === 'current_account')
      .reduce((sum, f) => {
        const startDate = parseISO(f.start_date);
        if (isSameMonth(startOfMonth(month), startOfMonth(startDate))) {
          return sum + Number(f.amount);
        }
        return sum;
      }, 0);
  };

  const getGrantsForMonth = (month: Date): number => {
    if (!showFinancing) return 0;
    return financings
      .filter(f => {
        const nameLC = f.name?.toLowerCase() || '';
        return nameLC.includes('subvention') || nameLC.includes('aide') || nameLC.includes('grant');
      })
      .reduce((sum, f) => {
        const startDate = parseISO(f.start_date);
        if (isSameMonth(startOfMonth(month), startOfMonth(startDate))) {
          return sum + Number(f.amount);
        }
        return sum;
      }, 0);
  };

  const getLoanDisbursements = (month: Date): number => {
    const monthStart = startOfMonth(month);
    return financings
      .filter(f => f.financing_type === 'loan')
      .filter(f => startOfMonth(parseISO(f.start_date)).getTime() === monthStart.getTime())
      .reduce((sum, f) => sum + Number(f.amount), 0);
  };
  const getMonthlyLoanPayments = (month: Date): number =>
    financings
      .filter(f => f.financing_type === 'loan' && isFinancingActiveInMonth(f, month))
      .reduce((sum, f) => sum + Number(f.monthly_payment), 0);
  const getMonthlyLeasePayments = (month: Date): number =>
    financings
      .filter(f => f.financing_type === 'lease' && isFinancingActiveInMonth(f, month))
      .reduce((sum, f) => sum + Number(f.monthly_payment), 0);

  // Directors breakdown — parity with useDirectors.getBreakdownForMonth (no normalizeRate)
  const getDirectorsBreakdown = (month: Date): number => {
    const active = directors.filter(d => isPersonActiveInMonth(d, month));
    const remuneration = active.reduce((sum, d) => sum + Number(d.monthly_remuneration), 0);
    const charges = active.reduce(
      (sum, d) => sum + (Number(d.monthly_remuneration) * Number(d.charges_rate)),
      0
    );
    return remuneration + charges;
  };

  // ─── INFLOWS ───
  const inflowsRevenue: number[] = [];
  const inflowsLoans: number[] = [];
  const inflowsCapital: number[] = [];
  const inflowsGrants: number[] = [];
  const inflowsCurrentAccount: number[] = [];

  months.forEach((month, i) => {
    const revenueSourceIndex = i - customerDelay;
    const revenue = revenueSourceIndex >= 0 && revenueSourceIndex < monthlyPLData.length
      ? monthlyPLData[revenueSourceIndex].revenue : 0;
    inflowsRevenue.push(revenue);
    inflowsLoans.push(showFinancing ? getLoanDisbursements(month) : 0);
    inflowsCapital.push(getCapitalContributionsForMonth(month));
    inflowsGrants.push(getGrantsForMonth(month));
    inflowsCurrentAccount.push(getCurrentAccountContributionsForMonth(month));
  });

  const totalInflows = months.map((_, i) =>
    inflowsRevenue[i] + inflowsLoans[i] + inflowsCapital[i] + inflowsGrants[i] + inflowsCurrentAccount[i]
  );

  // ─── OUTFLOWS ───
  const outflowsFixed: number[] = [];
  const outflowsVariable: number[] = [];
  const outflowsPersonnel: number[] = [];
  const outflowsDirectors: number[] = [];
  const outflowsPayrollTaxes: number[] = [];
  const outflowsInvestments: number[] = [];
  const outflowsLoanPayments: number[] = [];
  const outflowsLeasePayments: number[] = [];
  const outflowsVAT: number[] = [];
  const outflowsTax: number[] = [];

  months.forEach((month, i) => {
    const fixedSourceIndex = i - supplierDelay;
    const fixedExp = fixedSourceIndex >= 0 && fixedSourceIndex < monthlyPLData.length
      ? monthlyPLData[fixedSourceIndex].fixedExpenses : 0;
    outflowsFixed.push(fixedExp);

    const variableExp = fixedSourceIndex >= 0 && fixedSourceIndex < monthlyPLData.length
      ? monthlyPLData[fixedSourceIndex].variableExpenses : 0;
    outflowsVariable.push(variableExp);

    const personnelSourceIndex = i - 1;
    const personnel = personnelSourceIndex >= 0 && personnelSourceIndex < monthlyPLData.length
      ? monthlyPLData[personnelSourceIndex].personnelCosts : 0;
    outflowsPersonnel.push(personnel);

    outflowsDirectors.push(getDirectorsBreakdown(month));

    const payrollTaxes = i > 0 && monthlyPLData[i] ? monthlyPLData[i].payrollTaxes : 0;
    outflowsPayrollTaxes.push(payrollTaxes);

    outflowsInvestments.push(getInvestmentCashOutForMonth(month));
    outflowsLoanPayments.push(showFinancing ? getMonthlyLoanPayments(month) : 0);
    outflowsLeasePayments.push(showFinancing ? getMonthlyLeasePayments(month) : 0);

    const vatBalance = monthlyPLData[i]?.vatBalance || 0;
    outflowsVAT.push(vatBalance > 0 ? vatBalance : 0);

    const taxPayment = monthlyPLData[i]?.corporateTax || 0;
    outflowsTax.push(taxPayment > 0 ? taxPayment : 0);
  });

  const totalOutflows = months.map((_, i) =>
    outflowsFixed[i] + outflowsVariable[i] + outflowsPersonnel[i] +
    outflowsDirectors[i] + outflowsPayrollTaxes[i] + outflowsInvestments[i] +
    outflowsLoanPayments[i] + outflowsLeasePayments[i] +
    outflowsVAT[i] + outflowsTax[i]
  );

  const netFlow = months.map((_, i) => totalInflows[i] - totalOutflows[i]);
  const balance: number[] = [];
  let runningBalance = initialCash;
  netFlow.forEach(nf => { runningBalance += nf; balance.push(runningBalance); });

  const minBalance = balance.length > 0 ? Math.min(...balance) : 0;
  const maxBalance = balance.length > 0 ? Math.max(...balance) : 0;
  const finalBalance = balance.length > 0 ? balance[balance.length - 1] : initialCash;
  const monthsWithNegativeBalance = balance.filter(b => b < 0).length;

  let lowestMonth: CashFlowData['lowestMonth'] = null;
  if (balance.length > 0) {
    const minIdx = balance.indexOf(minBalance);
    lowestMonth = { month: months[minIdx], balance: minBalance, index: minIdx };
  }
  let highestMonth: CashFlowData['highestMonth'] = null;
  if (balance.length > 0) {
    const maxIdx = balance.indexOf(maxBalance);
    highestMonth = { month: months[maxIdx], balance: maxBalance, index: maxIdx };
  }

  const monthlyData: CashFlowMonthData[] = months.map((month, i) => ({
    month,
    monthLabel: format(month, 'MMM yyyy'),
    inflows: {
      revenue: inflowsRevenue[i],
      loanDisbursements: inflowsLoans[i],
      capitalContributions: inflowsCapital[i],
      grants: inflowsGrants[i],
      currentAccountContributions: inflowsCurrentAccount[i],
      total: totalInflows[i],
    },
    outflows: {
      fixedExpenses: outflowsFixed[i],
      variableExpenses: outflowsVariable[i],
      personnel: outflowsPersonnel[i],
      directors: outflowsDirectors[i],
      payrollTaxes: outflowsPayrollTaxes[i],
      investments: outflowsInvestments[i],
      loanPayments: outflowsLoanPayments[i],
      leasePayments: outflowsLeasePayments[i],
      vatPayments: outflowsVAT[i],
      taxPayments: outflowsTax[i],
      total: totalOutflows[i],
    },
    netFlow: netFlow[i],
    balance: balance[i],
  }));

  return {
    months,
    monthlyData,
    inflows: {
      revenue: inflowsRevenue,
      loanDisbursements: inflowsLoans,
      capitalContributions: inflowsCapital,
      grants: inflowsGrants,
      currentAccountContributions: inflowsCurrentAccount,
      total: totalInflows,
    },
    outflows: {
      fixedExpenses: outflowsFixed,
      variableExpenses: outflowsVariable,
      personnel: outflowsPersonnel,
      directors: outflowsDirectors,
      payrollTaxes: outflowsPayrollTaxes,
      investments: outflowsInvestments,
      loanPayments: outflowsLoanPayments,
      leasePayments: outflowsLeasePayments,
      vatPayments: outflowsVAT,
      taxPayments: outflowsTax,
      total: totalOutflows,
    },
    netFlow,
    balance,
    initialBalance: initialCash,
    finalBalance,
    minBalance,
    maxBalance,
    monthsWithNegativeBalance,
    lowestMonth,
    highestMonth,
    totalInflows: totalInflows.reduce((a, b) => a + b, 0),
    totalOutflows: totalOutflows.reduce((a, b) => a + b, 0),
  };
}
