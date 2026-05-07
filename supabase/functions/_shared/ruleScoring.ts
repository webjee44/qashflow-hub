/**
 * PR3 — Specificity scoring for automation rules.
 *
 * Used by:
 *  - automation-rule-preview (preview returns proposed score)
 *  - apply-automation-rule / apply-all-automation-rules (sort + conflict detection)
 *  - rule create/update flow (persisted to automation_rules.specificity_score)
 *
 * Scoring scale (additive):
 *   +50  merchant_key exact match
 *   +20  bank_account_id / bridge_account_id present
 *   +15  amount_around / amount_between / amount equals
 *   +10  recurrence true
 *    +5  day_of_month / day_of_month_between
 *    +2  description contains (>=4 chars)
 *   -20  description contains a too-short pattern (<4 chars) or a generic stop-word
 *
 * The goal is to make merchant-anchored rules dominate naive 2-letter description rules.
 */

export interface ScoredCondition {
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

const GENERIC_DESCRIPTION_TOKENS = new Set([
  'CARTE', 'PAIEMENT', 'VIR', 'SEPA', 'PRLV', 'CB', 'EUR', 'USD',
  'INTERNET', 'PRELEVEMENT', 'COMMANDE', 'POUR', 'INST', 'FACTURE',
]);

export function computeSpecificityScore(conditions: ScoredCondition[]): number {
  if (!conditions || conditions.length === 0) return 0;
  let score = 0;
  for (const c of conditions) {
    const field = (c.condition_field || '').toLowerCase();
    const value = (c.condition_value || '').trim();

    if (field === 'merchant_key') {
      score += 50;
      continue;
    }
    if (field === 'bridge_account_id' || field === 'bank_account_id' || field === 'bank_account_name') {
      score += 20;
      continue;
    }
    if (field === 'amount' || field === 'amount_around' || field === 'amount_between') {
      score += 15;
      continue;
    }
    if (field === 'recurrence' || field === 'is_recurring') {
      score += 10;
      continue;
    }
    if (field === 'day_of_month' || field === 'day_of_month_between') {
      score += 5;
      continue;
    }
    if (field === 'description') {
      const trimmed = value.toUpperCase();
      if (trimmed.length < 4 || GENERIC_DESCRIPTION_TOKENS.has(trimmed)) {
        score -= 20;
      } else {
        score += 2;
      }
    }
  }
  return score;
}

/**
 * Conflict detection: two candidate rules collide when their specificity score
 * is within `threshold` and they could match the same transaction set.
 *
 * The runner uses this to *skip* application and emit `status='skipped_conflict'`
 * instead of letting the cheaper-by-created_at rule silently win.
 */
export function isConflictingScore(a: number, b: number, threshold = 5): boolean {
  return Math.abs(a - b) < threshold;
}
