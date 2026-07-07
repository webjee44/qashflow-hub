/**
 * computeBalanceAnchors — anchor de solde par "backward walk".
 *
 * Cause racine adressée : le calcul historique du plan de trésorerie s'appuyait
 * sur `bank_balance_snapshots` (getSnapshotForDate) pour dériver l'ouverture de
 * chaque mois. Comme le pipeline snapshot est instable et qu'il y a très peu de
 * snapshots datés du 1er du mois, la logique retombait sur `liveBankBalance` en
 * tant qu'ouverture du mois COURANT — ce qui provoquait un double comptage
 * (les flux du mois étaient recomptés au-dessus d'un solde qui les incluait
 * déjà) et rendait tout mois passé sans snapshot "sans données" alors même
 * que le ledger de transactions permettait de le reconstruire.
 *
 * Nouvelle règle, source de vérité unique :
 *
 *     opening(M) = currentBalance − Σ transactions [1er de M ; asOfDate]
 *
 * où `currentBalance` est le solde bancaire live (somme des comptes actifs) et
 * les transactions sont SIGNÉES (income = +, expense = −), incluent les
 * `is_ignored` (car elles ont réellement bougé la banque) et excluent les
 * `deleted_at`.
 *
 * Priorité : override sur M−1 (clôture manuelle = ouverture de M) > backward
 * walk > noData (le 1er de M est antérieur à la première transaction
 * disponible).
 *
 * Les mois futurs ne sont pas calculés ici : le hook les dérive par marche
 * avant à partir de l'ancre du mois courant (ouverture backward-walk +
 * Σ nets projetés). Le solde live n'est PLUS JAMAIS utilisé directement
 * comme ouverture du mois courant.
 */

import { dayKeyParis, monthKey } from '@/lib/finance';

export interface AnchorTransaction {
  /** ISO date or Date. Bucketed via Europe/Paris day key. */
  date: string | Date;
  /** SIGNED amount: income > 0, expense < 0. */
  amount: number;
}

export interface AnchorOverride {
  /** `YYYY-MM-01` or `YYYY-MM` — closing balance of that month. */
  month: string;
  balance: number;
}

export interface OpeningAnchor {
  monthKey: string;
  balance: number;
  isActual: boolean;
  noData: boolean;
  source: 'override' | 'backward_walk' | 'no_data';
}

export interface ComputeBalanceAnchorsInput {
  currentBalance: number;
  transactions: AnchorTransaction[];
  asOfDate: Date | string;
  /** Requested opening months (any order, any granularity — only monthKey is used). */
  months: Array<Date | string>;
  overrides?: AnchorOverride[];
  /**
   * Earliest transaction date available for this company. If a requested
   * month starts strictly before this month, the opening is `noData` (the
   * backward walk would silently return `currentBalance`, misleading the UI).
   */
  earliestTransactionDate?: Date | string | null;
}

function shiftMonthKey(mk: string, delta: number): string {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12, 0, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function computeBalanceAnchors(
  input: ComputeBalanceAnchorsInput,
): Map<string, OpeningAnchor> {
  const asOfKey = dayKeyParis(input.asOfDate);
  const asOfMk = asOfKey.slice(0, 7);

  const overridesByMk = new Map<string, number>();
  for (const o of input.overrides ?? []) {
    // Accept both 'YYYY-MM' and 'YYYY-MM-DD'.
    const key = o.month.length >= 7 ? o.month.slice(0, 7) : o.month;
    overridesByMk.set(key, Number(o.balance) || 0);
  }

  const earliestMk = input.earliestTransactionDate
    ? monthKey(input.earliestTransactionDate)
    : null;

  // Precompute (dayKey, amount). One pass — the outer loop is small (~months).
  const txs: Array<{ day: string; amount: number }> = [];
  for (const t of input.transactions) {
    const amount = Number(t.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    txs.push({ day: dayKeyParis(t.date), amount });
  }

  const result = new Map<string, OpeningAnchor>();
  const uniqueMks = new Set<string>();
  for (const m of input.months) uniqueMks.add(monthKey(m));

  for (const mk of uniqueMks) {
    // Only past & current months are anchored here.
    if (mk > asOfMk) continue;

    // 1. Override on M−1 = closing of previous month = opening of M.
    const prevMk = shiftMonthKey(mk, -1);
    if (overridesByMk.has(prevMk)) {
      result.set(mk, {
        monthKey: mk,
        balance: overridesByMk.get(prevMk)!,
        isActual: true,
        noData: false,
        source: 'override',
      });
      continue;
    }

    // 2. noData bound: the 1st of M is before any known transaction.
    if (earliestMk && mk < earliestMk) {
      result.set(mk, {
        monthKey: mk,
        balance: 0,
        isActual: true,
        noData: true,
        source: 'no_data',
      });
      continue;
    }

    // 3. Backward walk: opening(M) = currentBalance − Σ tx ∈ [firstOfM, asOfDate]
    const firstDay = `${mk}-01`;
    let sum = 0;
    for (const t of txs) {
      if (t.day >= firstDay && t.day <= asOfKey) sum += t.amount;
    }
    result.set(mk, {
      monthKey: mk,
      balance: input.currentBalance - sum,
      isActual: true,
      noData: false,
      source: 'backward_walk',
    });
  }

  return result;
}
