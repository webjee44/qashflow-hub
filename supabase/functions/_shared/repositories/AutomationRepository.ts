import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface AutomationRule {
  id: string;
  target_category_id: string;
  user_id: string;
  company_id: string | null;
  match_count: number;
  is_active: boolean;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

export interface RuleCondition {
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

export class AutomationRepository {
  constructor(private client: SupabaseClient) {}

  private chunkIds(ids: string[], chunkSize = 100): string[][] {
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += chunkSize) {
      chunks.push(ids.slice(index, index + chunkSize));
    }
    return chunks;
  }

  async findById(ruleId: string) {
    const { data, error } = await this.client
      .from('automation_rules')
      .select('*')
      .eq('id', ruleId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findActiveRules(options?: { userId?: string; companyId?: string }) {
    let query = this.client
      .from('automation_rules')
      .select('*')
      .eq('is_active', true)
      .not('target_category_id', 'is', null);

    // Company-scoped rules are shared across all members of the company.
    // When a companyId is provided, fetch all rules for that company regardless of creator.
    // Otherwise, fall back to user-scoped rules (legacy / personal rules without company).
    if (options?.companyId) {
      query = query.eq('company_id', options.companyId);
    } else if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async findConditionsByRuleIds(ruleIds: string[]): Promise<RuleCondition & { rule_id: string }[]> {
    if (ruleIds.length === 0) return [];

    const conditions: (RuleCondition & { rule_id: string })[] = [];
    for (const batch of this.chunkIds(ruleIds)) {
      const { data, error } = await this.client
        .from('automation_rule_conditions')
        .select('*')
        .in('rule_id', batch);

      if (error) throw error;
      conditions.push(...((data || []) as any));
    }

    return conditions;
  }

  async updateMatchCount(ruleId: string, newCount: number) {
    const { error } = await this.client
      .from('automation_rules')
      .update({ match_count: newCount })
      .eq('id', ruleId);

    if (error) throw error;
  }
}
