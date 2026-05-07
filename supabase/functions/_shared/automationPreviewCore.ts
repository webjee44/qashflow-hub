// Shared logic for the automation rule preview / dry-run engine.
// Pure functions, no Supabase client, easily testable in Vitest + Deno.

import {
  matchesAutomationCondition,
  type AutomationRuleConditionLikeCore,
  type TransactionLikeCore,
} from './automationRuleMatchingCore.ts';
import {
  computeSpecificityBreakdown,
  type ScoreBreakdown,
} from './ruleScoring.ts';

export interface PreviewCondition extends AutomationRuleConditionLikeCore {}

export interface PreviewTransaction extends TransactionLikeCore {
  id: string;
  category_id: string | null;
  amount: number | string;
  date?: string | null;
  merchant_key?: string | null;
  normalized_description?: string | null;
}

export interface MerchantSuggestion {
  merchant_key: string;
  match_count: number;
  sample_description: string;
}

export interface PreviewExistingRule {
  id: string;
  name: string;
  target_category_id: string | null;
  target_category_type?: string | null;
  conditions: PreviewCondition[];
}

export interface PreviewRequest {
  conditions: PreviewCondition[];
  target_category_id: string | null;
  target_category_type?: 'income' | 'expense' | null;
  rule_id_being_edited?: string | null;
}

export interface PreviewExampleTx {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string | null;
  current_category_id: string | null;
  status: 'will_apply' | 'already_target' | 'already_other' | 'type_mismatch';
}

export interface PreviewResult {
  matched_total: number;
  matched_uncategorized: number;
  matched_already_categorized: number;
  same_category_count: number;
  other_category_count: number;
  type_mismatch_count: number;
  existing_categories_distribution: Array<{ category_id: string; count: number }>;
  conflicts_with_other_rules: Array<{ rule_id: string; rule_name: string; overlap_count: number }>;
  total_amount_impact: number;
  safety_score: number;
  warnings: string[];
  examples: PreviewExampleTx[];
  specificity_breakdown: ScoreBreakdown;
  merchant_suggestions: MerchantSuggestion[];
}

const SHORT_PATTERN_THRESHOLD = 4;

function ruleMatches(tx: PreviewTransaction, conditions: PreviewCondition[]): boolean {
  if (conditions.length === 0) return false;
  return conditions.every((c) => matchesAutomationCondition(c, tx));
}

function computeWarnings(
  request: PreviewRequest,
  result: Omit<PreviewResult, 'warnings' | 'safety_score'>,
): string[] {
  const warnings: string[] = [];

  for (const c of request.conditions) {
    if (
      c.condition_field === 'description' &&
      typeof c.condition_value === 'string' &&
      c.condition_value.trim().length > 0 &&
      c.condition_value.trim().length < SHORT_PATTERN_THRESHOLD
    ) {
      warnings.push('pattern_too_short');
      break;
    }
  }

  if (result.matched_total > 500) warnings.push('high_match_volume');
  if (result.other_category_count > 0) warnings.push('historical_category_conflict');
  if (result.type_mismatch_count > 0) warnings.push('type_mismatch');
  if (result.conflicts_with_other_rules.length > 0) warnings.push('overlapping_rules');
  if (Math.abs(result.total_amount_impact) > 50_000) warnings.push('high_amount');

  return warnings;
}

function computeSafetyScore(
  result: Omit<PreviewResult, 'warnings' | 'safety_score'>,
  warnings: string[],
): number {
  // Base on historical agreement: how many already-classified transactions
  // already go to the target category.
  let score = 1;

  const historicalSeen = result.matched_already_categorized;
  if (historicalSeen > 0) {
    const agreement = result.same_category_count / historicalSeen;
    // Strong agreement → keep close to 1, low agreement → drop to 0.3.
    score = 0.3 + agreement * 0.7;
  } else if (result.matched_total === 0) {
    // No historical evidence at all and zero matches → moderate trust.
    score = 0.5;
  } else {
    // Matches exist but none historically classified → mild caution.
    score = 0.7;
  }

  if (warnings.includes('pattern_too_short')) score -= 0.25;
  if (warnings.includes('historical_category_conflict')) score -= 0.15;
  if (warnings.includes('type_mismatch')) score -= 0.15;
  if (warnings.includes('high_match_volume')) score -= 0.05;
  if (warnings.includes('high_amount')) score -= 0.05;
  if (warnings.includes('overlapping_rules')) score -= 0.1;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export function computePreview(
  request: PreviewRequest,
  transactions: PreviewTransaction[],
  otherRules: PreviewExistingRule[] = [],
): PreviewResult {
  const matched = transactions.filter((t) => ruleMatches(t, request.conditions));

  let matched_uncategorized = 0;
  let same_category_count = 0;
  let other_category_count = 0;
  let type_mismatch_count = 0;
  let total_amount_impact = 0;

  const distribution = new Map<string, number>();
  const examples: PreviewExampleTx[] = [];

  for (const t of matched) {
    const amountAbs = Math.abs(Number(t.amount) || 0);
    const typeOk =
      !request.target_category_type ||
      !t.type ||
      request.target_category_type === t.type;

    if (!typeOk) {
      type_mismatch_count++;
      if (examples.length < 10) {
        examples.push({
          id: t.id,
          description: t.description,
          amount: amountAbs,
          type: t.type,
          date: t.date ?? null,
          current_category_id: t.category_id,
          status: 'type_mismatch',
        });
      }
      continue;
    }

    if (!t.category_id) {
      matched_uncategorized++;
      total_amount_impact += amountAbs;
      if (examples.length < 10) {
        examples.push({
          id: t.id,
          description: t.description,
          amount: amountAbs,
          type: t.type,
          date: t.date ?? null,
          current_category_id: null,
          status: 'will_apply',
        });
      }
    } else {
      distribution.set(t.category_id, (distribution.get(t.category_id) || 0) + 1);
      if (t.category_id === request.target_category_id) {
        same_category_count++;
        if (examples.length < 10) {
          examples.push({
            id: t.id,
            description: t.description,
            amount: amountAbs,
            type: t.type,
            date: t.date ?? null,
            current_category_id: t.category_id,
            status: 'already_target',
          });
        }
      } else {
        other_category_count++;
        if (examples.length < 10) {
          examples.push({
            id: t.id,
            description: t.description,
            amount: amountAbs,
            type: t.type,
            date: t.date ?? null,
            current_category_id: t.category_id,
            status: 'already_other',
          });
        }
      }
    }
  }

  const matched_already_categorized = same_category_count + other_category_count;

  const conflicts: Array<{ rule_id: string; rule_name: string; overlap_count: number }> = [];
  for (const other of otherRules) {
    if (!other.conditions.length) continue;
    if (request.rule_id_being_edited && other.id === request.rule_id_being_edited) continue;
    let overlap = 0;
    for (const t of matched) {
      if (!t.category_id && ruleMatches(t, other.conditions)) overlap++;
    }
    if (overlap > 0) {
      conflicts.push({ rule_id: other.id, rule_name: other.name, overlap_count: overlap });
    }
  }

  const partial: Omit<PreviewResult, 'warnings' | 'safety_score'> = {
    matched_total: matched.length,
    matched_uncategorized,
    matched_already_categorized,
    same_category_count,
    other_category_count,
    type_mismatch_count,
    existing_categories_distribution: [...distribution.entries()]
      .map(([category_id, count]) => ({ category_id, count }))
      .sort((a, b) => b.count - a.count),
    conflicts_with_other_rules: conflicts.sort((a, b) => b.overlap_count - a.overlap_count),
    total_amount_impact: Number(total_amount_impact.toFixed(2)),
    examples,
  };

  const warnings = computeWarnings(request, partial);
  const safety_score = computeSafetyScore(partial, warnings);

  return { ...partial, warnings, safety_score, examples };
}
