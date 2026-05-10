// ============================================================
// PR 0 RED — Variation de stock (signe + double-comptage)
// ============================================================
// Convention PCG retenue (cf. plan PR 3) :
//   merchandisePurchases[i]      = somme des achats N
//   stockVariation[i]            = stockFinal − stockInitial (positif si
//                                  le stock augmente → actif ↑)
//   coutDesAchatsConsommes[i]    = merchandisePurchases − stockVariation
//
// Fixture : initial 100, achats 500, final 150
//   → merchandisePurchases = 500
//   → stockVariation       = +50
//   → consommé             = 450
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { cleanEcommerceBPInput } from './__fixtures__/clean-ecommerce';

describe('PR 0 RED — variation de stock (PR 3)', () => {
  const model = computeBPModel(cleanEcommerceBPInput as any);

  it.fails('merchandisePurchases[Y1] = 500 €', () => {
    expect(model.pl.totals.merchandisePurchases[0]).toBeCloseTo(500, 0);
  });

  it.fails('stockVariation[Y1] = +50 € (stock final > initial)', () => {
    expect(model.pl.totals.stockVariation[0]).toBeCloseTo(50, 0);
  });

  it.fails('coût des achats consommés = 450 € (sans double comptage)', () => {
    const purchases = model.pl.totals.merchandisePurchases[0] || 0;
    const variation = model.pl.totals.stockVariation[0] || 0;
    expect(purchases - variation).toBeCloseTo(450, 0);
  });
});
