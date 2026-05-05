// computeCashFlow — pure cash flow computation (parity with useBPCashFlow)
import { parseISO, isAfter, isBefore, startOfMonth, endOfMonth, differenceInMonths, addMonths } from 'date-fns';
import { getLoanScheduleEntry } from '@/lib/french-rates';
import type { BPModelInput } from './types';
import type { PLData } from '../hooks/useProfitLoss';
import type { CashFlowData } from '../hooks/useBPCashFlow';

function isActiveInMonth(financing: any, month: Date): boolean {
  const startDate = parseISO(financing.start_date);
  const endDate = financing.end_date ? parseISO(financing.end_date) : addMonths(startDate, financing.duration_months || 60);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  return !isAfter(startDate, monthEnd) && !isBefore(endDate, monthStart);
}

export function computeCashFlow(input: BPModelInput, plData: PLData): CashFlowData {
  const { settings, financings } = input;
  const months = plData.years.flatMap(year => year.months);
  const customerDelay = Math.round((settings.customer_payment_delay || 30) / 30);
  const supplierDelay = Math.round((settings.supplier_payment_delay || 30) / 30);
  const initialCash = Number(settings.initial_cash) || 0;
  const showFinancing = settings.show_financing !== false;

  const monthlyRevenue: number[] = [];
  const monthlyFixedExpenses: number[] = [];
  const monthlyPersonnelCosts: number[] = [];
  const monthlySeverancePayments: number[] = [];

  plData.years.forEach((year, yearIndex) => {
    const monthCount = year.months.length;
    const yearRevenue = plData.totals.revenue[yearIndex] || 0;
    const yearFixed = plData.totals.fixedExpenses[yearIndex] || 0;
    const yearPersonnel = plData.totals.personnelCosts[yearIndex] || 0;
    const yearSeverance = plData.totals.severancePayments?.[yearIndex] || 0;
    for (let i = 0; i < monthCount; i++) {
      monthlyRevenue.push(yearRevenue / monthCount);
      monthlyFixedExpenses.push(yearFixed / monthCount);
      monthlyPersonnelCosts.push(yearPersonnel / monthCount);
      monthlySeverancePayments.push(yearSeverance / monthCount);
    }
  });

  const getLoanDisbursements = (month: Date): number => {
    const monthStart = startOfMonth(month);
    return financings
      .filter(f => f.financing_type === 'loan')
      .filter(f => startOfMonth(parseISO(f.start_date)).getTime() === monthStart.getTime())
      .reduce((sum, f) => sum + Number(f.amount), 0);
  };
  const getMonthlyLoanPayments = (month: Date): number => {
    return financings
      .filter(f => f.financing_type === 'loan' && isActiveInMonth(f, month))
      .reduce((sum, f) => sum + Number(f.monthly_payment), 0);
  };
  const getMonthlyLeasePayments = (month: Date): number => {
    return financings
      .filter(f => f.financing_type === 'lease' && isActiveInMonth(f, month))
      .reduce((sum, f) => sum + Number(f.monthly_payment), 0);
  };

  const loanDisbursements = showFinancing ? months.map(m => getLoanDisbursements(m)) : months.map(() => 0);
  const loanPayments = showFinancing ? months.map(m => getMonthlyLoanPayments(m)) : months.map(() => 0);
  const leasePayments = showFinancing ? months.map(m => getMonthlyLeasePayments(m)) : months.map(() => 0);
  const severancePayments = monthlySeverancePayments;

  const inflows = months.map((_, i) => {
    const sourceIndex = i - customerDelay;
    const revenue = sourceIndex >= 0 ? monthlyRevenue[sourceIndex] : 0;
    const loans = loanDisbursements[i] || 0;
    return revenue + loans;
  });
  const outflows = months.map((_, i) => {
    const sourceIndex = i - supplierDelay;
    let expenses = 0;
    if (sourceIndex >= 0) {
      expenses = monthlyFixedExpenses[sourceIndex] + monthlyPersonnelCosts[sourceIndex];
    }
    const financing = (loanPayments[i] || 0) + (leasePayments[i] || 0);
    const severance = severancePayments[i] || 0;
    return expenses + financing + severance;
  });
  const netFlow = months.map((_, i) => inflows[i] - outflows[i]);

  const balance: number[] = [];
  let runningBalance = initialCash;
  netFlow.forEach(nf => { runningBalance += nf; balance.push(runningBalance); });

  const minBalance = balance.length > 0 ? Math.min(...balance) : 0;
  const monthsWithNegativeBalance = balance.filter(b => b < 0).length;

  return {
    months, inflows, outflows, netFlow, balance,
    minBalance, monthsWithNegativeBalance,
    loanDisbursements, loanPayments, leasePayments, severancePayments,
  };
}
