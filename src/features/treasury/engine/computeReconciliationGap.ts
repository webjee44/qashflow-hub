/**
 * computeReconciliationGap — écart de réconciliation bancaire par mois.
 *
 * Cause racine adressée : depuis le backward walk (`computeBalanceAnchors`),
 * les ouvertures / clôtures reflètent la réalité bancaire (TOUTES les
 * transactions, y compris `is_ignored`), tandis que la « Variation nette du
 * mois » affichée exclut les transactions ignorées et peut aussi diverger
 * pour des raisons hors périmètre (mouvements comptabilisés hors ledger UI,
 * etc.). L'identité `ouverture(M) + variation(M) = clôture(M)` n'est donc
 * plus mécaniquement vraie sur le rendu UI, et l'écart doit être EXPLIQUÉ,
 * pas masqué.
 *
 * Définition :
 *
 *     écart(M) = [clôture bancaire(M) − ouverture bancaire(M)] − variationNetteAffichée(M)
 *
 * où :
 *   - ouverture bancaire(M)  = ancre backward-walk du mois M
 *   - clôture bancaire(M)    = ancre backward-walk du mois M+1
 *                              (pour le mois COURANT : `currentBalance` — le
 *                              solde bancaire live à `asOfDate`, puisque
 *                              opening(M+1) n'existe pas encore)
 *   - variationNetteAffichée = ce que la ligne « Variation nette du mois »
 *                              présente à l'utilisateur (côté « actual »),
 *                              soit la somme signée des flux ledger repris
 *                              dans la grille pour ce mois
 *
 * Cas simple : quand les seules divergences sont les transactions ignorées,
 * `écart(M) = Σ signés(is_ignored ∈ M)`.
 *
 * Périmètre :
 *   - Mois futurs → aucun écart (aucun réel bancaire à comparer).
 *   - Mois passé sans ancre next (par ex. horizon rétréci) → aucun écart.
 *   - Mois `noData` (ancre = 0, pas de ledger) → aucun écart.
 *
 * Ce module ne modifie JAMAIS les ouvertures/clôtures/totaux. Il expose
 * uniquement une information de réconciliation à afficher.
 */

import { monthKey } from '@/lib/finance';

export interface OpeningLike {
  balance: number;
  noData?: boolean;
}

export interface ComputeReconciliationGapInput {
  /** Months (any order, any granularity — only monthKey is used). */
  months: Array<string | Date>;
  /** Ancres d'ouverture par monthKey (issue de computeBalanceAnchors ou équivalent). */
  openingByMonth: Map<string, OpeningLike>;
  /** Variation nette affichée dans la ligne « Variation nette du mois », côté actual. */
  displayedNetByMonth: Map<string, number>;
  /** Solde bancaire live à `asOfDate` (somme des comptes actifs). */
  currentBalance: number;
  /** Date de référence Europe/Paris. Détermine le mois courant. */
  asOfDate: string | Date;
}

export interface ReconciliationGap {
  monthKey: string;
  gap: number;
  isCurrent: boolean;
}

function shiftMonthKey(mk: string, delta: number): string {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12, 0, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function computeReconciliationGap(
  input: ComputeReconciliationGapInput,
): Map<string, ReconciliationGap> {
  const currentMk = monthKey(input.asOfDate);
  const result = new Map<string, ReconciliationGap>();

  const uniqueMks = new Set<string>();
  for (const m of input.months) uniqueMks.add(monthKey(m));

  for (const mk of uniqueMks) {
    if (mk > currentMk) continue;

    const opening = input.openingByMonth.get(mk);
    if (!opening || opening.noData) continue;

    let bankDelta: number;
    let isCurrent = false;

    if (mk === currentMk) {
      bankDelta = input.currentBalance - opening.balance;
      isCurrent = true;
    } else {
      const nextMk = shiftMonthKey(mk, 1);
      const next = input.openingByMonth.get(nextMk);
      if (!next || next.noData) continue;
      bankDelta = next.balance - opening.balance;
    }

    const displayedNet = input.displayedNetByMonth.get(mk) ?? 0;
    const gap = bankDelta - displayedNet;

    result.set(mk, { monthKey: mk, gap, isCurrent });
  }

  return result;
}
