import { describe, it, expect } from 'vitest';
import {
  computeIntercompanyPositions,
  resolvePeriodPreset,
  type IntercompanyLinkForAgg,
} from '../computeIntercompanyPositions';

const link = (
  out: string,
  inn: string,
  amount: number,
  tx_date = '2026-06-15',
  status: IntercompanyLinkForAgg['status'] = 'auto_matched',
): IntercompanyLinkForAgg => ({
  company_out: out,
  company_in: inn,
  amount,
  status,
  tx_date,
});

describe('computeIntercompanyPositions — sémantique compte courant', () => {
  it('avance simple : le receveur doit à l’émetteur', () => {
    const agg = computeIntercompanyPositions([link('A', 'B', 1000, '2026-06-01')]);
    expect(agg.positions).toHaveLength(1);
    const p = agg.positions[0];
    expect(p.company_a).toBe('A');
    expect(p.company_b).toBe('B');
    // A envoie 1000 à B => B doit à A
    expect(p.balance_a_to_b).toBe(1000);
    expect(p.balance_abs).toBe(1000);
    expect(p.debtor).toBe('B');
    expect(p.creditor).toBe('A');
    expect(agg.openPositions).toHaveLength(1);
    expect(agg.totalOpenPositions).toBe(1000);
  });

  it('aller-retour : le solde net indique qui doit à qui', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 1000, '2026-01-10'),
      link('B', 'A', 300, '2026-02-15'),
    ]);
    const p = agg.positions[0];
    expect(p.gross_a_to_b).toBe(1000);
    expect(p.gross_b_to_a).toBe(300);
    expect(p.balance_a_to_b).toBe(700);
    expect(p.debtor).toBe('B');
    expect(p.creditor).toBe('A');
  });

  it('position équilibrée : ni débiteur ni créancier, exclue des ouvertes', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 500, '2026-01-01'),
      link('B', 'A', 500, '2026-02-01'),
    ]);
    const p = agg.positions[0];
    expect(p.balance_a_to_b).toBe(0);
    expect(p.debtor).toBeNull();
    expect(p.creditor).toBeNull();
    expect(agg.openPositions).toHaveLength(0);
    expect(agg.totalOpenPositions).toBe(0);
  });

  it('exclut rejected et suggested par défaut', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 1000, '2026-06-01', 'auto_matched'),
      link('A', 'B', 500, '2026-06-02', 'suggested'),
      link('A', 'B', 200, '2026-06-03', 'rejected'),
      link('A', 'B', 800, '2026-06-04', 'confirmed'),
    ]);
    expect(agg.positions[0].balance_a_to_b).toBe(1800);
  });

  it('inclut les suggested quand demandé', () => {
    const agg = computeIntercompanyPositions(
      [
        link('A', 'B', 1000, '2026-06-01', 'auto_matched'),
        link('A', 'B', 500, '2026-06-02', 'suggested'),
      ],
      { includeStatuses: ['auto_matched', 'confirmed', 'suggested'] },
    );
    expect(agg.positions[0].balance_a_to_b).toBe(1500);
  });

  it('SOLDE toujours cumulé — la période ne filtre QUE la variation', () => {
    const agg = computeIntercompanyPositions(
      [
        link('A', 'B', 1000, '2025-06-01'), // hors période
        link('A', 'B', 500, '2026-03-01'),  // dans période
        link('B', 'A', 200, '2026-04-01'),  // dans période
      ],
      { periodFrom: '2026-01-01', periodTo: '2026-12-31' },
    );
    const p = agg.positions[0];
    // Solde cumulé depuis toujours
    expect(p.balance_a_to_b).toBe(1300);
    expect(p.gross_a_to_b).toBe(1500);
    expect(p.gross_b_to_a).toBe(200);
    // Variation période = 500 - 200
    expect(p.variation_period).toBe(300);
    expect(p.movements_period).toBe(2);
    expect(p.movements_total).toBe(3);
  });

  it('tri par |solde| décroissant', () => {
    const agg = computeIntercompanyPositions([
      link('A', 'B', 100),
      link('C', 'D', 5000),
      link('D', 'C', 5000), // net 0 sur C/D
      link('E', 'F', 300),
    ]);
    expect(agg.positions.map(p => `${p.company_a}-${p.company_b}`)).toEqual([
      'E-F',
      'A-B',
      'C-D',
    ]);
  });

  it('vue par société : créancier / débiteur et détail par contrepartie', () => {
    // A avance 1000 à B et 400 à C. Personne ne rend rien.
    const agg = computeIntercompanyPositions([
      link('A', 'B', 1000),
      link('A', 'C', 400),
    ]);
    const byId = new Map(agg.perCompany.map(c => [c.company_id, c]));
    expect(byId.get('A')).toMatchObject({ total_receivable: 1400, total_debt: 0, net: 1400 });
    expect(byId.get('B')).toMatchObject({ total_receivable: 0, total_debt: 1000, net: -1000 });
    expect(byId.get('C')).toMatchObject({ total_receivable: 0, total_debt: 400, net: -400 });

    // Contrepartie B vue depuis A
    const aCounter = byId.get('A')!.counterparties.find(c => c.counterparty === 'B');
    expect(aCounter?.balance).toBe(1000); // B doit 1000 à A
    // Vue miroir depuis B
    const bCounter = byId.get('B')!.counterparties.find(c => c.counterparty === 'A');
    expect(bCounter?.balance).toBe(-1000);

    expect(agg.topCreditor?.company_id).toBe('A');
    expect(agg.topDebtor?.company_id).toBe('B');
    expect(agg.totalOpenPositions).toBe(1400);
  });

  it('retourne un agrégat vide sur input vide', () => {
    const agg = computeIntercompanyPositions([]);
    expect(agg.positions).toEqual([]);
    expect(agg.openPositions).toEqual([]);
    expect(agg.perCompany).toEqual([]);
    expect(agg.topCreditor).toBeNull();
    expect(agg.topDebtor).toBeNull();
    expect(agg.totalOpenPositions).toBe(0);
  });
});

describe('resolvePeriodPreset', () => {
  it('all : aucune borne', () => {
    expect(resolvePeriodPreset('all')).toEqual({});
  });

  it('année 2026 et 2025 bornées calendaires', () => {
    expect(resolvePeriodPreset('y2026')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(resolvePeriodPreset('y2025')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('12m : fenêtre glissante de 12 mois se termine aujourd’hui', () => {
    const today = new Date('2026-07-07T12:00:00Z');
    const b = resolvePeriodPreset('12m', today);
    expect(b.to).toBe('2026-07-07');
    expect(b.from).toBe('2025-07-07');
  });
});
