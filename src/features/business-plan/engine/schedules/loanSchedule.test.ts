import { describe, it, expect } from 'vitest';
import {
  buildLoanSchedule,
  buildAllLoanSchedules,
  totalOutstandingAt,
  sumPrincipalInRange,
  sumInterestInRange,
  sumPaymentsInRange,
  getEntryForMonth,
} from './loanSchedule';

const loan = {
  id: 'L1',
  financing_type: 'loan',
  amount: 100000,
  interest_rate: 4, // 4%
  duration_months: 60,
  start_date: '2025-01-01',
};

describe('buildLoanSchedule', () => {
  it('amortizes principal over the full duration', () => {
    const s = buildLoanSchedule(loan)!;
    expect(s).not.toBeNull();
    expect(s.entries.length).toBe(60);
    // Total principal repaid ≈ initial principal
    const totalPrincipal = s.entries.reduce((sum, e) => sum + e.principal, 0);
    expect(Math.abs(totalPrincipal - 100000)).toBeLessThan(1);
    // Final remaining ≈ 0
    expect(s.entries[59].remaining).toBeLessThan(1);
  });

  it('returns null for non-loan financings', () => {
    expect(buildLoanSchedule({ ...loan, financing_type: 'lease' })).toBeNull();
    expect(buildLoanSchedule({ ...loan, amount: 0 })).toBeNull();
  });

  it('outstanding at end of year 1 = initial - sum principal year 1', () => {
    const s = buildLoanSchedule(loan)!;
    const principalYear1 = s.entries.slice(0, 12).reduce((sum, e) => sum + e.principal, 0);
    const outstanding = totalOutstandingAt([s], new Date('2025-12-15'));
    expect(Math.abs(outstanding - (100000 - principalYear1))).toBeLessThan(1);
  });

  it('debt variation reconciles with principal repaid (Lot 2.3 invariant)', () => {
    const schedules = buildAllLoanSchedules([loan]);
    const startOfYear = new Date('2025-01-01');
    const endOfYear = new Date('2025-12-31');
    const debtBefore = totalOutstandingAt(schedules, new Date('2024-12-31')); // before start
    const debtAfter = totalOutstandingAt(schedules, endOfYear);
    const principalRepaid = sumPrincipalInRange(schedules, startOfYear, endOfYear);
    expect(Math.abs(debtBefore - debtAfter - principalRepaid)).toBeLessThan(1);
  });

  it('payments = interest + principal', () => {
    const schedules = buildAllLoanSchedules([loan]);
    const from = new Date('2025-01-01');
    const to = new Date('2025-12-31');
    const interest = sumInterestInRange(schedules, from, to);
    const principal = sumPrincipalInRange(schedules, from, to);
    const payments = sumPaymentsInRange(schedules, from, to);
    expect(Math.abs(payments - (interest + principal))).toBeLessThan(0.01);
  });

  it('getEntryForMonth returns null outside loan window', () => {
    const s = buildLoanSchedule(loan)!;
    expect(getEntryForMonth(s, new Date('2024-12-01'))).toBeNull();
    expect(getEntryForMonth(s, new Date('2030-06-01'))).toBeNull();
    expect(getEntryForMonth(s, new Date('2025-06-15'))).not.toBeNull();
  });
});
