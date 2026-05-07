import { supabase } from '@/integrations/supabase/client';
import type { ScoreBreakdown } from '../lib/ruleScoring';

export interface PreviewConditionInput {
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

export interface AutomationPreviewExample {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string | null;
  current_category_id: string | null;
  status: 'will_apply' | 'already_target' | 'already_other' | 'type_mismatch';
}

export interface MerchantSuggestion {
  merchant_key: string;
  match_count: number;
  sample_description: string;
}

export interface AutomationPreview {
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
  examples: AutomationPreviewExample[];
  specificity_breakdown: ScoreBreakdown;
  merchant_suggestions: MerchantSuggestion[];
}

export interface PreviewRequestInput {
  conditions: PreviewConditionInput[];
  target_category_id: string | null;
  company_id: string;
  rule_id_being_edited?: string | null;
}

export async function fetchAutomationRulePreview(
  input: PreviewRequestInput,
): Promise<AutomationPreview> {
  const { data, error } = await supabase.functions.invoke<AutomationPreview>(
    'automation-rule-preview',
    { body: input },
  );
  if (error) throw error;
  if (!data) throw new Error('Empty preview response');
  return data;
}
