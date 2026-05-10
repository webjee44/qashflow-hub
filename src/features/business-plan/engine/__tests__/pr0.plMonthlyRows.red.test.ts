// ============================================================
// PR 0 RED — `pl.monthlyRows` source unique (PR 6)
// ============================================================
// Le moteur doit exposer `pl.monthlyRows` aligné sur le calendrier
// `pl.years.flatMap(y => y.months)`. Les agrégats annuels
// (`pl.totals.*[i]`) doivent dériver d'une somme stricte de
// `monthlyRows` filtrées sur l'année i.
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { cleanEcommerceBPInput } from './__fixtures__/clean-ecommerce';

describe('PR 0 RED — pl.monthlyRows (PR 6)', () => {
  const model = computeBPModel(cleanEcommerceBPInput as any);
  const pl: any = model.pl;
  const totalMonths = pl.years.reduce((s: number, y: any) => s + y.months.length, 0);

  it.fails('pl.monthlyRows existe et est non vide', () => {
    expect(Array.isArray(pl.monthlyRows)).toBe(true);
    expect(pl.monthlyRows.length).toBeGreaterThan(0);
  });

  it.fails('chaque monthlyRow a values.length === total des mois', () => {
    for (const row of pl.monthlyRows ?? []) {
      expect(row.values.length).toBe(totalMonths);
    }
  });

  it.fails('agrégat manuel des monthlyRows.revenue ≈ pl.totals.revenue', () => {
    const revenueRow = (pl.monthlyRows ?? []).find(
      (r: any) => r.sectionType === 'revenue' && r.type === 'subtotal'
    );
    expect(revenueRow).toBeDefined();
    let offset = 0;
    for (let y = 0; y < pl.years.length; y++) {
      const len = pl.years[y].months.length;
      const sum = revenueRow!.values
        .slice(offset, offset + len)
        .reduce((a: number, b: number) => a + b, 0);
      expect(Math.abs(sum - (pl.totals.revenue[y] || 0))).toBeLessThan(1);
      offset += len;
    }
  });
});
