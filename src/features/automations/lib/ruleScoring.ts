/**
 * PR3/PR4 — Frontend mirror of `_shared/ruleScoring.ts` (edge function).
 * Keep both in sync.
 */

export interface ScoredCondition {
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

export type ScoreReason =
  | 'merchant_key'
  | 'bank_account'
  | 'amount'
  | 'recurrence'
  | 'day_of_month'
  | 'description_specific'
  | 'description_generic'
  | 'description_too_short'
  | 'unknown';

export interface ScoreContribution {
  condition_field: string;
  condition_value: string;
  delta: number;
  reason: ScoreReason;
}

export interface ScoreBreakdown {
  total: number;
  contributions: ScoreContribution[];
}

const GENERIC_DESCRIPTION_TOKENS = new Set([
  'CARTE', 'PAIEMENT', 'VIR', 'SEPA', 'PRLV', 'CB', 'EUR', 'USD',
  'INTERNET', 'PRELEVEMENT', 'COMMANDE', 'POUR', 'INST', 'FACTURE',
]);

export function computeSpecificityBreakdown(conditions: ScoredCondition[]): ScoreBreakdown {
  if (!conditions || conditions.length === 0) return { total: 0, contributions: [] };
  const contributions: ScoreContribution[] = [];
  for (const c of conditions) {
    const field = (c.condition_field || '').toLowerCase();
    const value = (c.condition_value || '').trim();

    if (field === 'merchant_key') {
      contributions.push({ condition_field: field, condition_value: value, delta: 50, reason: 'merchant_key' });
      continue;
    }
    if (field === 'bridge_account_id' || field === 'bank_account_id' || field === 'bank_account_name') {
      contributions.push({ condition_field: field, condition_value: value, delta: 20, reason: 'bank_account' });
      continue;
    }
    if (field === 'amount' || field === 'amount_around' || field === 'amount_between') {
      contributions.push({ condition_field: field, condition_value: value, delta: 15, reason: 'amount' });
      continue;
    }
    if (field === 'recurrence' || field === 'is_recurring') {
      contributions.push({ condition_field: field, condition_value: value, delta: 10, reason: 'recurrence' });
      continue;
    }
    if (field === 'day_of_month' || field === 'day_of_month_between') {
      contributions.push({ condition_field: field, condition_value: value, delta: 5, reason: 'day_of_month' });
      continue;
    }
    if (field === 'description' || field === 'normalized_description') {
      const trimmed = value.toUpperCase();
      if (trimmed.length < 4) {
        contributions.push({ condition_field: field, condition_value: value, delta: -20, reason: 'description_too_short' });
      } else if (GENERIC_DESCRIPTION_TOKENS.has(trimmed)) {
        contributions.push({ condition_field: field, condition_value: value, delta: -20, reason: 'description_generic' });
      } else {
        contributions.push({ condition_field: field, condition_value: value, delta: 2, reason: 'description_specific' });
      }
      continue;
    }
    contributions.push({ condition_field: field, condition_value: value, delta: 0, reason: 'unknown' });
  }
  const total = contributions.reduce((acc, c) => acc + c.delta, 0);
  return { total, contributions };
}

export function computeSpecificityScore(conditions: ScoredCondition[]): number {
  return computeSpecificityBreakdown(conditions).total;
}

export const SCORE_REASON_LABELS: Record<ScoreReason, string> = {
  merchant_key: 'Verrouillage commerçant (très spécifique)',
  bank_account: 'Compte bancaire ciblé',
  amount: 'Montant précis',
  recurrence: 'Récurrence',
  day_of_month: 'Jour du mois',
  description_specific: 'Mot-clé description',
  description_generic: 'Mot-clé générique (pénalisé)',
  description_too_short: 'Mot-clé trop court (pénalisé)',
  unknown: 'Critère ignoré',
};
