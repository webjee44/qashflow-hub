// ============================================================
// PR 0 — Tests RED : invariants moteur à respecter après PR 1→9
// ============================================================
// Toutes les assertions ci-dessous décrivent l'état CIBLE du moteur.
// Elles sont marquées `it.fails(...)` : tant qu'elles échouent (état
// actuel), la suite est verte. Dès qu'une PR corrige le moteur, le
// test passe RÉELLEMENT vert et il faut basculer `it.fails` → `it`.
//
// Ne JAMAIS supprimer un test ici sans justification écrite dans le
// diff de la PR concernée.
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { cleanEcommerceBPInput } from './__fixtures__/clean-ecommerce';

describe('PR 0 RED — invariants comptables (fixture clean-ecommerce)', () => {
  const model = computeBPModel(cleanEcommerceBPInput as any);
  const yearCount = model.pl.years.length;

  // ─── Bilan équilibré ───
  it.fails('bilan : |actif − passif| < 1 € chaque année (PR 2)', () => {
    for (let i = 0; i < yearCount; i++) {
      const a = model.balanceSheet.totals.totalAssets[i] || 0;
      const l = model.balanceSheet.totals.totalLiabilities[i] || 0;
      expect(Math.abs(a - l)).toBeLessThan(1);
    }
  });

  // ─── Réconciliation cash-flow / bilan / plan de financement ───
  it.fails('réconciliation : cashFlow.balance(fin Y) = balanceSheet.cash[Y] = fundingPlan.cumulativeBalance[Y] (PR 5)', () => {
    for (let i = 0; i < yearCount; i++) {
      const yearMonths = model.pl.years[i].months.length;
      const offset = model.pl.years
        .slice(0, i)
        .reduce((s, y) => s + y.months.length, 0);
      const cashAtYearEnd = model.cashFlow.balance[offset + yearMonths - 1] || 0;
      const bsCash = model.balanceSheet.cash[i] || 0;
      const fpCum = model.fundingPlan.cumulativeBalance[i] || 0;
      expect(Math.abs(cashAtYearEnd - bsCash)).toBeLessThan(1);
      expect(Math.abs(cashAtYearEnd - fpCum)).toBeLessThan(1);
    }
  });
});
