// ============================================================
// PR 0 RED — Charges patronales
// ============================================================
// Salaire brut 3 000 € × normalizeRate(45) = 1 350 €.
// P&L : charges patronales = 1 350 € le mois M.
// Cash-flow : 1 350 € en M+1 (décalage par défaut, helper dédié).
// La TVA n'est PAS assimilée à ce flux : code distinct, helper distinct.
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { cleanEcommerceBPInput } from './__fixtures__/clean-ecommerce';

describe('PR 0 RED — charges patronales (PR 4)', () => {
  const model = computeBPModel(cleanEcommerceBPInput as any);

  it.fails('P&L : charges patronales mensuelles ≈ 1 350 € (3000 × 0.45)', () => {
    // Lecture via monthlyRows (introduit en PR 6). En attendant, on
    // fait l'agrégat via totaux annuels / nb mois.
    const y0Months = model.pl.years[0].months.length;
    const y0PayrollTaxes = model.pl.totals.payrollTaxes[0] || 0;
    const monthly = y0PayrollTaxes / y0Months;
    expect(monthly).toBeGreaterThan(1340);
    expect(monthly).toBeLessThan(1360);
  });

  it.fails('Cash-flow : charges patronales décalées de M+1 (≠ TVA)', () => {
    // Mois 0 (janvier) → cash-flow charges patronales = 0
    // Mois 1 (février) → cash-flow charges patronales = 1 350
    const cf0 = model.cashFlow.outflows.payrollTaxes[0] || 0;
    const cf1 = model.cashFlow.outflows.payrollTaxes[1] || 0;
    expect(cf0).toBeLessThan(1);
    expect(cf1).toBeGreaterThan(1340);
    expect(cf1).toBeLessThan(1360);
  });
});
