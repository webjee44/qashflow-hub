import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { minimalBPInput } from './__fixtures__/minimal-bp';

// These invariants MUST stay green across all refactors.
// They are independent of golden snapshots and document the
// non-negotiable accounting properties of the engine.
describe('computeBPModel — accounting invariants', () => {
  const model = computeBPModel(minimalBPInput);
  const yearCount = model.pl.years.length;

  it('balance sheet is balanced every year (assets = liabilities)', () => {
    for (let i = 0; i < yearCount; i++) {
      const assets = model.balanceSheet.totals.totalAssets[i] || 0;
      const liab = model.balanceSheet.totals.totalLiabilities[i] || 0;
      const tolerance = Math.max(1, Math.abs(assets) * 0.001);
      expect(Math.abs(assets - liab)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('debt variation = new loans − principal repayments', () => {
    for (let i = 0; i < yearCount; i++) {
      const prev = i === 0 ? 0 : model.balanceSheet.totals.financialDebts[i - 1] || 0;
      const curr = model.balanceSheet.totals.financialDebts[i] || 0;
      const newLoans = model.fundingPlan.resources.newLoans[i] || 0;
      const repaid = model.fundingPlan.needs.loanRepayments[i] || 0;
      const expected = newLoans - repaid;
      const tolerance = Math.max(1, Math.abs(expected) * 0.001);
      expect(Math.abs((curr - prev) - expected)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('validation report has no critical errors on the minimal fixture', () => {
    expect(model.validation.summary.errors).toBe(0);
  });

  it('engineVersion is exposed', () => {
    expect(model.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
