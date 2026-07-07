/**
 * matchIntercompanyTransfers — moteur pur d'appariement des flux intergroupes.
 *
 * Fonction pure, sans DB : prend les transactions candidates + alias sociétés +
 * liens existants, retourne les décisions (auto_matched / suggested / ignored).
 *
 * Doctrine :
 *  - une transaction ne peut appartenir qu'à un lien (contrainte UNIQUE côté DB) ;
 *  - jamais d'auto en cas d'ambiguïté (>=2 contreparties au même meilleur score) ;
 *  - scoring transparent (breakdown persisté pour audit).
 */

export type IntercompanyTxType = 'income' | 'expense';

export interface IntercompanyTx {
  id: string;
  company_id: string;
  /** ISO YYYY-MM-DD */
  date: string;
  /** Montant en valeur absolue. */
  amount: number;
  type: IntercompanyTxType;
  description: string | null;
}

export interface CompanyAlias {
  company_id: string;
  /** Motifs à chercher dans les libellés (nom société + banques/comptes connus). */
  aliases: string[];
}

export interface ExistingLink {
  tx_out_id: string;
  tx_in_id: string;
  company_out: string;
  company_in: string;
  status: 'auto_matched' | 'suggested' | 'confirmed' | 'rejected';
}

export interface ScoreBreakdown {
  base_opposite: number;         // +40
  same_day: number;              // 0..20
  alias_match: number;           // 0 | 25
  recurring_pair: number;        // 0 | 15
  round_amount_penalty: number;  // -15 | 0
}

export interface IntercompanyMatchDecision {
  tx_out_id: string;
  tx_in_id: string;
  company_out: string;
  company_in: string;
  amount: number;
  /** Date de la transaction sortie (YYYY-MM-DD). Source de vérité pour l'aggrégation temporelle. */
  tx_date: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  status: 'auto_matched' | 'suggested';
}


export interface MatchInput {
  transactions: IntercompanyTx[];
  aliases: CompanyAlias[];
  existingLinks: ExistingLink[];
  /** Montant minimum absolu (défaut 500). */
  minAmount?: number;
  /** Fenêtre de date en jours (défaut 3). */
  maxDayGap?: number;
  /** Seuil auto (défaut 75). */
  autoThreshold?: number;
  /** Seuil suggested (défaut 50). */
  suggestedThreshold?: number;
}

// -------------------- helpers --------------------

function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a + 'T00:00:00Z');
  const db = Date.parse(b + 'T00:00:00Z');
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) < 0.005;
}

function monthKey(d: string): string {
  return d.slice(0, 7);
}

function isRoundAmount(amount: number): boolean {
  const abs = Math.abs(amount);
  // multiple de 100 (ex. 500, 1000, 2500, 10 000...) et pas de centimes
  return abs >= 500 && Math.abs(abs - Math.round(abs)) < 0.005 && Math.round(abs) % 100 === 0;
}

// -------------------- pair recurrence --------------------

function buildRecurringPairs(existing: ExistingLink[]): Set<string> {
  const counts = new Map<string, number>();
  for (const l of existing) {
    if (l.status !== 'auto_matched' && l.status !== 'confirmed') continue;
    const key = pairKey(l.company_out, l.company_in);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const set = new Set<string>();
  for (const [k, n] of counts) if (n >= 3) set.add(k);
  return set;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildAliasIndex(aliases: CompanyAlias[]): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const a of aliases) {
    idx.set(
      a.company_id,
      a.aliases.map(normalize).filter(x => x.length >= 3),
    );
  }
  return idx;
}

function descriptionContainsAlias(desc: string | null, aliasesForOtherCompany: string[]): boolean {
  if (!desc || aliasesForOtherCompany.length === 0) return false;
  const n = normalize(desc);
  return aliasesForOtherCompany.some(alias => n.includes(alias));
}

// -------------------- scoring --------------------

interface Candidate {
  txOut: IntercompanyTx;
  txIn: IntercompanyTx;
  score: number;
  breakdown: ScoreBreakdown;
}

function scoreCandidate(
  txOut: IntercompanyTx,
  txIn: IntercompanyTx,
  aliasIdx: Map<string, string[]>,
  recurringPairs: Set<string>,
  roundAmountFrequency: Map<string, number>,
): Candidate {
  const gap = daysBetween(txOut.date, txIn.date);
  const sameDayBonus = gap === 0 ? 20 : gap <= 1 ? 10 : 0;

  const aliasesOfIn = aliasIdx.get(txIn.company_id) ?? [];
  const aliasesOfOut = aliasIdx.get(txOut.company_id) ?? [];
  const aliasMatch =
    descriptionContainsAlias(txOut.description, aliasesOfIn) ||
    descriptionContainsAlias(txIn.description, aliasesOfOut)
      ? 25
      : 0;

  const recurring = recurringPairs.has(pairKey(txOut.company_id, txIn.company_id)) ? 15 : 0;

  let roundPenalty = 0;
  if (isRoundAmount(txOut.amount)) {
    const key = `${monthKey(txOut.date)}|${Math.round(Math.abs(txOut.amount))}`;
    const freq = roundAmountFrequency.get(key) ?? 0;
    if (freq > 5) roundPenalty = -15;
  }

  const breakdown: ScoreBreakdown = {
    base_opposite: 40,
    same_day: sameDayBonus,
    alias_match: aliasMatch,
    recurring_pair: recurring,
    round_amount_penalty: roundPenalty,
  };
  const score =
    breakdown.base_opposite +
    breakdown.same_day +
    breakdown.alias_match +
    breakdown.recurring_pair +
    breakdown.round_amount_penalty;

  return { txOut, txIn, score, breakdown };
}

// -------------------- main --------------------

export function matchIntercompanyTransfers(input: MatchInput): IntercompanyMatchDecision[] {
  const minAmount = input.minAmount ?? 500;
  const maxGap = input.maxDayGap ?? 3;
  const autoThreshold = input.autoThreshold ?? 75;
  const suggestedThreshold = input.suggestedThreshold ?? 50;

  const linkedIds = new Set<string>();
  for (const l of input.existingLinks) {
    linkedIds.add(l.tx_out_id);
    linkedIds.add(l.tx_in_id);
  }

  const filtered = input.transactions.filter(
    t => Math.abs(t.amount) >= minAmount && !linkedIds.has(t.id),
  );

  const outs = filtered.filter(t => t.type === 'expense');
  const ins = filtered.filter(t => t.type === 'income');

  const aliasIdx = buildAliasIndex(input.aliases);
  const recurring = buildRecurringPairs(input.existingLinks);

  // Compte des montants ronds/mois pour la pénalité récurrence
  const roundFreq = new Map<string, number>();
  for (const t of filtered) {
    if (!isRoundAmount(t.amount)) continue;
    const key = `${monthKey(t.date)}|${Math.round(Math.abs(t.amount))}`;
    roundFreq.set(key, (roundFreq.get(key) ?? 0) + 1);
  }

  // Index ins par (amount arrondi, company) pour lookup rapide
  const insByAmount = new Map<number, IntercompanyTx[]>();
  for (const it of ins) {
    const k = Math.round(Math.abs(it.amount) * 100);
    const arr = insByAmount.get(k) ?? [];
    arr.push(it);
    insByAmount.set(k, arr);
  }

  // Pour chaque sortie, trouver toutes les entrées candidates
  const outCandidates = new Map<string, Candidate[]>(); // key = tx_out_id
  for (const o of outs) {
    const k = Math.round(Math.abs(o.amount) * 100);
    const insSameAmount = insByAmount.get(k) ?? [];
    const list: Candidate[] = [];
    for (const i of insSameAmount) {
      if (i.company_id === o.company_id) continue;
      if (!amountsEqual(o.amount, i.amount)) continue;
      if (daysBetween(o.date, i.date) > maxGap) continue;
      list.push(scoreCandidate(o, i, aliasIdx, recurring, roundFreq));
    }
    if (list.length > 0) outCandidates.set(o.id, list);
  }

  // Résolution : trier par score décroissant, greedy avec anti-ambiguïté.
  const decisions: IntercompanyMatchDecision[] = [];
  const usedIn = new Set<string>();
  const usedOut = new Set<string>();

  const outIds = Array.from(outCandidates.keys()).sort((a, b) => {
    const ma = Math.max(...outCandidates.get(a)!.map(c => c.score));
    const mb = Math.max(...outCandidates.get(b)!.map(c => c.score));
    return mb - ma;
  });

  for (const oid of outIds) {
    if (usedOut.has(oid)) continue;
    const cands = outCandidates
      .get(oid)!
      .filter(c => !usedIn.has(c.txIn.id))
      .sort((a, b) => b.score - a.score);
    if (cands.length === 0) continue;
    const best = cands[0];
    if (best.score < suggestedThreshold) continue;

    // Anti-ambiguïté : si ≥2 candidats au même meilleur score => suggested
    const tiedTop = cands.filter(c => Math.abs(c.score - best.score) < 0.001);
    const status: 'auto_matched' | 'suggested' =
      tiedTop.length > 1
        ? 'suggested'
        : best.score >= autoThreshold
          ? 'auto_matched'
          : 'suggested';

    decisions.push({
      tx_out_id: best.txOut.id,
      tx_in_id: best.txIn.id,
      company_out: best.txOut.company_id,
      company_in: best.txIn.company_id,
      amount: Math.abs(best.txOut.amount),
      tx_date: best.txOut.date,
      score: best.score,
      score_breakdown: best.breakdown,
      status,
    });
    usedOut.add(best.txOut.id);
    usedIn.add(best.txIn.id);
  }

  return decisions;
}
