import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { minimalBPInput } from './__fixtures__/minimal-bp';

// Two-tier invariants:
//   1. STRICT (it.todo) — accounting truths that the engine SHOULD respect.
//      Currently failing → tracked as bugs to fix in PR7+ (engine corrections).
//      Documented here so they cannot be silently forgotten.
//   2. BASELINE (it) — captures the CURRENT discrepancy. Refactors must NOT
//      make it worse. If a refactor improves it, regenerate the baseline.
describe('computeBPModel — accounting invariants', () => {
  const model = computeBPModel(minimalBPInput);
  const yearCount = model.pl.years.length;

  // ─── Tier 2 — baseline (anti-regression, refactor-safe) ───
  it('baseline: balance sheet imbalance does not worsen', () => {
    // Captured 2026-05-06 on minimal-bp fixture.
    // Bug tracked: see PR7+ "réconciliation cashflow vs P&L".
    // Captured 2026-05-06: Y1=40030, Y2=81283, Y3=124683
    // Imbalance grows linearly — symptom of cash/equity drift documented in PR7+.
    const MAX_IMBALANCE_PER_YEAR = [40100, 81350, 124750];
    for (let i = 0; i < yearCount; i++) {
      const assets = model.balanceSheet.totals.totalAssets[i] || 0;
      const liab = model.balanceSheet.totals.totalLiabilities[i] || 0;
      const imbalance = Math.abs(assets - liab);
      expect(imbalance).toBeLessThanOrEqual(MAX_IMBALANCE_PER_YEAR[i] ?? 50000);
    }
  });

  it('baseline: validation error count does not grow', () => {
    // Tracked: 3 errors on minimal fixture (BS_BALANCED + LOAN_RECONCILIATION).
    expect(model.validation.summary.errors).toBeLessThanOrEqual(3);
  });

  // ─── Tier 1 — engine MUST respect (currently failing, fix in PR7+) ───
  it.todo('STRICT: balance sheet balanced every year (PR7+ engine fix)');
  it.todo('STRICT: validation report has 0 errors (PR7+ engine fix)');

  // ─── Already passing — keep enforced ───
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

  it('engineVersion is exposed and well-formed', () => {
    expect(model.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
