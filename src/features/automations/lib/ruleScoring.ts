/**
 * PR3 — Frontend mirror of `_shared/ruleScoring.ts` (edge function).
 *
 * Kept in sync intentionally — both files use the same additive scale so that
 * the score persisted on rule create/update matches the score the runner sees.
 *
 * If you change the scale, change it in BOTH:
 *  - supabase/functions/_shared/ruleScoring.ts
 *  - src/features/automations/lib/ruleScoring.ts
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
    if (field === 'merchant_key') { score += 50; continue; }
    if (field === 'bridge_account_id' || field === 'bank_account_id' || field === 'bank_account_name') { score += 20; continue; }
    if (field === 'amount' || field === 'amount_around' || field === 'amount_between') { score += 15; continue; }
    if (field === 'recurrence' || field === 'is_recurring') { score += 10; continue; }
    if (field === 'day_of_month' || field === 'day_of_month_between') { score += 5; continue; }
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
