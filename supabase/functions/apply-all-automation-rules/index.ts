import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseServices } from '../_shared/serviceFactory.ts';
import { type RuleCondition } from '../_shared/repositories/AutomationRepository.ts';
import { matchesAutomationCondition } from '../_shared/automationRuleMatchingCore.ts';
import { computeSpecificityScore, isConflictingScore } from '../_shared/ruleScoring.ts';
import { createRun, appendRunItems, finishRun, type RunItemInput } from '../_shared/automationRunLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FullRule {
  id: string;
  target_category_id: string;
  target_category_type: string;
  user_id: string;
  company_id: string | null;
  match_count: number;
  is_active: boolean;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  extra_conditions: RuleCondition[];
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
  user_id: string;
  company_id: string | null;
  bank_account_name: string | null;
}

// Match a single condition against a transaction
function matchCondition(transaction: Transaction, condition: RuleCondition): boolean {
  return matchesAutomationCondition(condition, transaction);
}

function matchesRule(transaction: Transaction, rule: FullRule): boolean {
  // Type guard: prevent assigning income category to expense transaction and vice versa
  if (rule.target_category_type && transaction.type !== rule.target_category_type) {
    return false;
  }

  const primaryCondition: RuleCondition = {
    condition_field: rule.condition_field,
    condition_operator: rule.condition_operator,
    condition_value: rule.condition_value,
  };
  if (!matchCondition(transaction, primaryCondition)) return false;
  if (rule.extra_conditions && rule.extra_conditions.length > 0) {
    return rule.extra_conditions.every(c => matchCondition(transaction, c));
  }
  return true;
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[apply-all-automation-rules] Starting...');

  try {
    const { supabaseAdmin, automationRepo, transactionRepo } = createSupabaseServices();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    // Check if this is a user-initiated request or cron
    const authHeader = req.headers.get('Authorization');
    let userFilter: string | null = null;
    let companyFilter: string | null = null;

    if (authHeader) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      try {
        const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
        if (!userError && user) {
          userFilter = user.id;
          try {
            const body = await req.json();
            companyFilter = body.company_id || null;
          } catch { /* No body */ }
          console.log(`[apply-all-automation-rules] User-initiated: ${userFilter}, company: ${companyFilter || 'all'}`);
        } else {
          console.log('[apply-all-automation-rules] CRON/anon call - processing all rules');
        }
      } catch (e) {
        console.log('[apply-all-automation-rules] Auth check failed, processing all rules:', e);
      }
    }

    // 1. Fetch active rules via repository
    const rules = await automationRepo.findActiveRules({
      userId: userFilter || undefined,
      companyId: companyFilter || undefined,
    });

    if (rules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active rules', matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[apply-all-automation-rules] Found ${rules.length} active rules`);

    // 2. Fetch extra conditions via repository
    const ruleIds = rules.map(r => r.id);
    const allExtraConditions = await automationRepo.findConditionsByRuleIds(ruleIds);

    // Group by rule_id
    const extraConditionsByRule = new Map<string, RuleCondition[]>();
    for (const condition of allExtraConditions) {
      const ruleConditions = extraConditionsByRule.get((condition as any).rule_id) || [];
      ruleConditions.push({
        condition_field: condition.condition_field,
        condition_operator: condition.condition_operator,
        condition_value: condition.condition_value,
      });
      extraConditionsByRule.set((condition as any).rule_id, ruleConditions);
    }

    // Fetch category types for all target categories (type guard)
    const categoryIds = [...new Set(rules.map(r => r.target_category_id).filter(Boolean))];
    const categoryTypeMap = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categories } = await supabaseAdmin
        .from('categories')
        .select('id, type')
        .in('id', categoryIds);
      for (const cat of categories || []) {
        categoryTypeMap.set(cat.id, cat.type);
      }
    }

    const rulesWithConditions: FullRule[] = rules
      .filter(rule => rule.condition_field && rule.condition_operator && rule.condition_value)
      .map(rule => ({
        id: rule.id,
        target_category_id: rule.target_category_id,
        target_category_type: categoryTypeMap.get(rule.target_category_id) || '',
        user_id: rule.user_id,
        company_id: rule.company_id,
        match_count: rule.match_count || 0,
        is_active: rule.is_active,
        condition_field: rule.condition_field,
        condition_operator: rule.condition_operator,
        condition_value: rule.condition_value,
        extra_conditions: extraConditionsByRule.get(rule.id) || [],
      }));

    if (rulesWithConditions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No rules with valid conditions', matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group rules by user_id
    const rulesByUser = new Map<string, FullRule[]>();
    for (const rule of rulesWithConditions) {
      if (!rulesByUser.has(rule.user_id)) rulesByUser.set(rule.user_id, []);
      rulesByUser.get(rule.user_id)!.push(rule);
    }

    let totalMatched = 0;
    let totalUpdated = 0;
    const ruleUpdates: { ruleId: string; additionalMatches: number }[] = [];

    for (const [userId, userRules] of rulesByUser) {
      console.log(`[apply-all-automation-rules] Processing ${userRules.length} rules for user ${userId}`);

      // Fetch uncategorized transactions via repository
      const allTransactions = await transactionRepo.findUncategorized(
        companyFilter ? { companyId: companyFilter } : { userId },
      );

      console.log(`[apply-all-automation-rules] Found ${allTransactions.length} uncategorized transactions for user ${userId}`);
      if (allTransactions.length === 0) continue;

      // Apply rules
      const transactionUpdates = new Map<string, string>();

      for (const rule of userRules) {
        const matchingTxs = (allTransactions as unknown as Transaction[]).filter(tx => {
          if (transactionUpdates.has(tx.id)) return false;
          if (rule.company_id && tx.company_id !== rule.company_id) return false;
          return matchesRule(tx, rule);
        });

        for (const tx of matchingTxs) {
          transactionUpdates.set(tx.id, rule.target_category_id);
        }

        if (matchingTxs.length > 0) {
          ruleUpdates.push({ ruleId: rule.id, additionalMatches: matchingTxs.length });
        }
      }

      totalMatched += transactionUpdates.size;

      // Apply updates via repository, grouped by category
      const updatesByCategory = new Map<string, string[]>();
      for (const [txId, categoryId] of transactionUpdates) {
        if (!updatesByCategory.has(categoryId)) updatesByCategory.set(categoryId, []);
        updatesByCategory.get(categoryId)!.push(txId);
      }

      for (const [categoryId, txIds] of updatesByCategory) {
        const batches = chunkArray(txIds, 100);
        for (const batch of batches) {
          try {
            await transactionRepo.bulkUpdateCategory(batch, categoryId);
            totalUpdated += batch.length;
          } catch (err) {
            console.error('[apply-all-automation-rules] Error updating batch:', err);
          }
        }
      }
    }

    // Update match counts via repository
    for (const { ruleId, additionalMatches } of ruleUpdates) {
      const rule = rules.find(r => r.id === ruleId);
      if (rule) {
        await automationRepo.updateMatchCount(ruleId, (rule.match_count || 0) + additionalMatches);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[apply-all-automation-rules] Completed in ${duration}ms: ${totalMatched} matched, ${totalUpdated} updated`);

    return new Response(
      JSON.stringify({ 
        success: true,
        rules_processed: rulesWithConditions.length,
        matched: totalMatched, 
        updated: totalUpdated,
        duration_ms: duration
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[apply-all-automation-rules] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
