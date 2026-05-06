// ============================================================
// buildLoanSchedule — single source of truth for loan amortization
// ============================================================
// Pure. No React, no Supabase.
// Consumed by:
//   - computePL          (interest → 66 charges financières)
//   - computeCashFlow    (interest + principal = cash outflow)
//   - computeBalanceSheet (capital restant dû → dettes financières)
//   - computeFundingPlan  (principal repayment → besoin)
//
// PR 2 / Lot 2.3.
// ============================================================

import { addMonths, parseISO, startOfMonth, differenceInMonths } from 'date-fns';
import { calculateLoanPayment } from '@/lib/french-rates';

export interface LoanScheduleMonthEntry {
  month: Date;
  interest: number;
  principal: number;
  payment: number;
  remaining: number; // capital restant dû à la FIN du mois
}

export interface LoanSchedule {
  financingId: string;
  startDate: Date;
  endDate: Date;
  initialPrincipal: number;
  monthlyPayment: number;
  entries: LoanScheduleMonthEntry[]; // un par mois sur la durée de l'emprunt
}

/**
 * Build a full month-by-month amortization schedule for one loan.
 * Returns an empty schedule for non-loan financings or invalid inputs.
 */
export function buildLoanSchedule(financing: any): LoanSchedule | null {
  if (!financing || financing.financing_type !== 'loan') return null;
  const principal = Number(financing.amount) || 0;
  const annualRatePercent = Number(financing.interest_rate) || 0;
  const duration = Number(financing.duration_months) || 0;
  if (principal <= 0 || duration <= 0) return null;

  const startDate = startOfMonth(parseISO(financing.start_date));
  const endDate = addMonths(startDate, duration - 1);

  const monthlyRate = annualRatePercent / 100 / 12;
  const { monthlyPayment } = calculateLoanPayment(principal, annualRatePercent, duration);

  const entries: LoanScheduleMonthEntry[] = [];
  let remaining = principal;
  for (let i = 0; i < duration; i++) {
    const interest = remaining * monthlyRate;
    const principalPaid = Math.max(0, monthlyPayment - interest);
    remaining = Math.max(0, remaining - principalPaid);
    entries.push({
      month: addMonths(startDate, i),
      interest,
      principal: principalPaid,
      payment: monthlyPayment,
      remaining,
    });
  }

  return {
    financingId: String(financing.id ?? ''),
    startDate,
    endDate,
    initialPrincipal: principal,
    monthlyPayment,
    entries,
  };
}

/**
 * Build schedules for all loans in the input set.
 */
export function buildAllLoanSchedules(financings: any[]): LoanSchedule[] {
  return financings
    .map(buildLoanSchedule)
    .filter((s): s is LoanSchedule => s !== null);
}

/**
 * Find the schedule entry for a given month, or null if loan inactive that month.
 */
export function getEntryForMonth(
  schedule: LoanSchedule,
  month: Date
): LoanScheduleMonthEntry | null {
  const monthStart = startOfMonth(month);
  const idx = differenceInMonths(monthStart, schedule.startDate);
  if (idx < 0 || idx >= schedule.entries.length) return null;
  return schedule.entries[idx];
}

/**
 * Total outstanding capital across all loans at the end of `atDate`.
 * If the loan hasn't started yet, its full initial principal counts as outstanding.
 */
export function totalOutstandingAt(schedules: LoanSchedule[], atDate: Date): number {
  const monthStart = startOfMonth(atDate);
  return schedules.reduce((sum, s) => {
    if (monthStart < s.startDate) return sum + s.initialPrincipal;
    const idx = Math.min(
      s.entries.length - 1,
      differenceInMonths(monthStart, s.startDate)
    );
    if (idx < 0) return sum + s.initialPrincipal;
    return sum + s.entries[idx].remaining;
  }, 0);
}

/**
 * Sum interest paid in [from, to] inclusive.
 */
export function sumInterestInRange(
  schedules: LoanSchedule[],
  from: Date,
  to: Date
): number {
  return schedules.reduce((total, s) => {
    return (
      total +
      s.entries.reduce((sum, e) => {
        if (e.month >= from && e.month <= to) return sum + e.interest;
        return sum;
      }, 0)
    );
  }, 0);
}

/**
 * Sum principal repaid in [from, to] inclusive.
 */
export function sumPrincipalInRange(
  schedules: LoanSchedule[],
  from: Date,
  to: Date
): number {
  return schedules.reduce((total, s) => {
    return (
      total +
      s.entries.reduce((sum, e) => {
        if (e.month >= from && e.month <= to) return sum + e.principal;
        return sum;
      }, 0)
    );
  }, 0);
}

/**
 * Sum of all payments (interest + principal) in [from, to] inclusive.
 */
export function sumPaymentsInRange(
  schedules: LoanSchedule[],
  from: Date,
  to: Date
): number {
  return sumInterestInRange(schedules, from, to) + sumPrincipalInRange(schedules, from, to);
}

/**
 * Sum loan disbursements (initial principal at start month) in [from, to] inclusive.
 */
export function sumDisbursementsInRange(
  schedules: LoanSchedule[],
  from: Date,
  to: Date
): number {
  return schedules.reduce((sum, s) => {
    if (s.startDate >= from && s.startDate <= to) return sum + s.initialPrincipal;
    return sum;
  }, 0);
}
