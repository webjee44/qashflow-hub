import { describe, it, expect } from 'vitest';
import {
  computeIntercompanyPositions,
  type IntercompanyLinkForAgg,
} from '../computeIntercompanyPositions';

const link = (
  out: string,
  inn: string,
  amount: number,
  status: IntercompanyLinkForAgg['status'] = 'auto_matched',
  matched_at = '2026-06-15T00:00:00Z',
): IntercompanyLinkForAgg => ({
  company_out: out,
  company_in: inn,
  amount,
  status,
  matched_at,
});

describe('computeIntercompanyPositions', () => {
  it('agrège les flux bruts par couple ordonné', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 1000),
      link('A', 'B', 500),
      link('B', 'A', 300),
    ]);
    expect(agg.directional).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ company_out: 'A', company_in: 'B', gross_amount: 1500, link_count: 2 }),
        expect.objectContaining({ company_out: 'B', company_in: 'A', gross_amount: 300, link_count: 1 }),
      ]),
    );
    expect(agg.totalGross).toBe(1800);
    expect(agg.totalLinks).toBe(3);
  });

  it('calcule la position nette par paire non ordonnée', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 1000),
      link('B', 'A', 300),
    ]);
    expect(agg.net).toHaveLength(1);
    const pair = agg.net[0];
    expect(pair.company_a).toBe('A');
    expect(pair.company_b).toBe('B');
    expect(pair.gross_a_to_b).toBe(1000);
    expect(pair.gross_b_to_a).toBe(300);
    expect(pair.net_a_to_b).toBe(700);
    expect(pair.link_count).toBe(2);
  });

  it('exclut les liens rejected et suggested par défaut', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 1000, 'auto_matched'),
      link('A', 'B', 500, 'suggested'),
      link('A', 'B', 200, 'rejected'),
      link('A', 'B', 800, 'confirmed'),
    ]);
    expect(agg.totalGross).toBe(1800);
    expect(agg.totalLinks).toBe(2);
  });

  it('inclut les suggested quand demandé', () => {
    const agg = computeIntercompanyPositions(
      [
        link('A', 'B', 1000, 'auto_matched'),
        link('A', 'B', 500, 'suggested'),
        link('A', 'B', 200, 'rejected'),
      ],
      { includeStatuses: ['auto_matched', 'confirmed', 'suggested'] },
    );
    expect(agg.totalGross).toBe(1500);
    expect(agg.totalLinks).toBe(2);
  });

  it('filtre par période (from/to inclusifs)', () => {
    const agg = computeIntercompanyPositions(
      [
        link('A', 'B', 100, 'auto_matched', '2026-01-01T00:00:00Z'),
        link('A', 'B', 200, 'auto_matched', '2026-06-01T00:00:00Z'),
        link('A', 'B', 400, 'auto_matched', '2026-12-31T00:00:00Z'),
      ],
      { from: '2026-05-01', to: '2026-11-30' },
    );
    expect(agg.totalGross).toBe(200);
  });

  it('agrège les totaux par société (inflow/outflow/net)', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 1000),
      link('C', 'A', 400),
    ]);
    const map = new Map(agg.perCompany.map(c => [c.company_id, c]));
    expect(map.get('A')).toMatchObject({ outflow: 1000, inflow: 400, net: -600, link_count: 2 });
    expect(map.get('B')).toMatchObject({ outflow: 0, inflow: 1000, net: 1000, link_count: 1 });
    expect(map.get('C')).toMatchObject({ outflow: 400, inflow: 0, net: -400, link_count: 1 });
  });

  it('retourne un agrégat vide sur input vide', () => {
    const agg = computeIntercompanyPositions([]);
    expect(agg).toEqual({
      directional: [],
      net: [],
      perCompany: [],
      totalGross: 0,
      totalLinks: 0,
    });
  });

  it('trie net par valeur absolue décroissante', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 100),
      link('C', 'D', 5000),
      link('D', 'C', 5000), // net 0 sur C/D
      link('E', 'F', 300),
    ]);
    expect(agg.net.map(p => `${p.company_a}-${p.company_b}`)).toEqual([
      'E-F',
      'A-B',
      'C-D',
    ]);
  });
});
