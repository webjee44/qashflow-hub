import { describe, it, expect } from 'vitest';
import {
  matchIntercompanyTransfers,
  type IntercompanyTx,
  type CompanyAlias,
  type ExistingLink,
} from '../matchIntercompanyTransfers';

const C_A = '00000000-0000-0000-0000-00000000000a';
const C_B = '00000000-0000-0000-0000-00000000000b';
const C_C = '00000000-0000-0000-0000-00000000000c';

function tx(
  id: string,
  company: string,
  date: string,
  amount: number,
  type: 'income' | 'expense',
  description: string | null = null,
): IntercompanyTx {
  return { id, company_id: company, date, amount, type, description };
}

const aliases: CompanyAlias[] = [
  { company_id: C_A, aliases: ['Tradeflix', 'BNP TRADEFLIX'] },
  { company_id: C_B, aliases: ['Vapeclub'] },
  { company_id: C_C, aliases: ['Vapostore'] },
];

describe('matchIntercompanyTransfers', () => {
  it('apparie une paire simple avec alias en auto_matched', () => {
    const txs: IntercompanyTx[] = [
      tx('o1', C_A, '2026-06-10', 1234.56, 'expense', 'Virement Vapeclub loyer'),
      tx('i1', C_B, '2026-06-10', 1234.56, 'income', 'Virement de Tradeflix'),
    ];
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: [] });
    expect(decisions).toHaveLength(1);
    expect(decisions[0].status).toBe('auto_matched');
    expect(decisions[0].tx_out_id).toBe('o1');
    expect(decisions[0].tx_in_id).toBe('i1');
    expect(decisions[0].amount).toBeCloseTo(1234.56);
    expect(decisions[0].score).toBeGreaterThanOrEqual(75);
  });

  it('ambiguïté (deux entrées meilleures ex aequo) => suggested', () => {
    const txs: IntercompanyTx[] = [
      tx('o1', C_A, '2026-06-10', 2000, 'expense', 'Virement'),
      tx('i1', C_B, '2026-06-10', 2000, 'income', 'Virement'),
      tx('i2', C_C, '2026-06-10', 2000, 'income', 'Virement'),
    ];
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: [] });
    expect(decisions).toHaveLength(1);
    expect(decisions[0].status).toBe('suggested');
  });

  it('respecte la fenêtre de dates (Δ > 3 jours => rejeté)', () => {
    const txs: IntercompanyTx[] = [
      tx('o1', C_A, '2026-06-01', 3000, 'expense'),
      tx('i1', C_B, '2026-06-10', 3000, 'income'),
    ];
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: [] });
    expect(decisions).toHaveLength(0);
  });

  it('sans alias, score de base (40+20=60) => suggested', () => {
    const txs: IntercompanyTx[] = [
      tx('o1', C_A, '2026-06-10', 777.77, 'expense', 'Virement 12345'),
      tx('i1', C_B, '2026-06-10', 777.77, 'income', 'REF 998877'),
    ];
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: [] });
    expect(decisions).toHaveLength(1);
    expect(decisions[0].status).toBe('suggested');
    expect(decisions[0].score).toBe(60);
  });

  it('paire récurrente (>=3 liens existants) confère bonus', () => {
    const existing: ExistingLink[] = Array.from({ length: 3 }, (_, k) => ({
      tx_out_id: `oe${k}`,
      tx_in_id: `ie${k}`,
      company_out: C_A,
      company_in: C_B,
      status: 'auto_matched' as const,
    }));
    const txs: IntercompanyTx[] = [
      tx('o1', C_A, '2026-06-10', 900, 'expense', 'Virement REF'),
      tx('i1', C_B, '2026-06-10', 900, 'income', 'Virement REF'),
    ];
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: existing });
    expect(decisions).toHaveLength(1);
    expect(decisions[0].score).toBe(40 + 20 + 15); // base+sameday+recurring
    expect(decisions[0].status).toBe('suggested');
  });

  it('montant rond fréquent => pénalité -15', () => {
    // 6 sorties de 1000 EUR le même mois, sociétés variées
    const txs: IntercompanyTx[] = [];
    for (let k = 0; k < 6; k++) {
      txs.push(tx(`o${k}`, C_A, '2026-06-05', 1000, 'expense', 'Virement'));
      txs.push(tx(`i${k}`, C_B, '2026-06-05', 1000, 'income', 'Virement'));
    }
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: [] });
    // Chaque décision inclut la pénalité -15
    expect(decisions.length).toBeGreaterThan(0);
    for (const d of decisions) {
      expect(d.score_breakdown.round_amount_penalty).toBe(-15);
    }
  });

  it('idempotence : les transactions déjà liées sont ignorées', () => {
    const txs: IntercompanyTx[] = [
      tx('o1', C_A, '2026-06-10', 1500, 'expense', 'Vapeclub'),
      tx('i1', C_B, '2026-06-10', 1500, 'income', 'Tradeflix'),
    ];
    const existing: ExistingLink[] = [
      { tx_out_id: 'o1', tx_in_id: 'i1', company_out: C_A, company_in: C_B, status: 'auto_matched' },
    ];
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: existing });
    expect(decisions).toHaveLength(0);
  });

  it('ignore les transactions sous le seuil minAmount', () => {
    const txs: IntercompanyTx[] = [
      tx('o1', C_A, '2026-06-10', 100, 'expense', 'Vapeclub'),
      tx('i1', C_B, '2026-06-10', 100, 'income', 'Tradeflix'),
    ];
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: [] });
    expect(decisions).toHaveLength(0);
  });

  it('même société : aucun appariement', () => {
    const txs: IntercompanyTx[] = [
      tx('o1', C_A, '2026-06-10', 800, 'expense'),
      tx('i1', C_A, '2026-06-10', 800, 'income'),
    ];
    const decisions = matchIntercompanyTransfers({ transactions: txs, aliases, existingLinks: [] });
    expect(decisions).toHaveLength(0);
  });
});
