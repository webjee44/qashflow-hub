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
  priority: number;
  specificity_score: number;
  created_at: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  extra_conditions: RuleCondition[];
  name: string;
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
      .map(rule => {
        const extras = extraConditionsByRule.get(rule.id) || [];
        // PR3 — recompute specificity from current conditions (DB column may lag).
        const allConds = [
          { condition_field: rule.condition_field, condition_operator: rule.condition_operator, condition_value: rule.condition_value },
          ...extras,
        ];
        const specificity = (rule as any).specificity_score ?? computeSpecificityScore(allConds);
        return {
          id: rule.id,
          target_category_id: rule.target_category_id,
          target_category_type: categoryTypeMap.get(rule.target_category_id) || '',
          user_id: rule.user_id,
          company_id: rule.company_id,
          match_count: rule.match_count || 0,
          is_active: rule.is_active,
          priority: (rule as any).priority ?? 100,
          specificity_score: Number(specificity) || 0,
          created_at: (rule as any).created_at ?? new Date().toISOString(),
          condition_field: rule.condition_field,
          condition_operator: rule.condition_operator,
          condition_value: rule.condition_value,
          extra_conditions: extras,
          name: (rule as any).name ?? '',
        };
      })
      // PR3 — sort: priority DESC, specificity DESC, created_at ASC.
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (b.specificity_score !== a.specificity_score) return b.specificity_score - a.specificity_score;
        return a.created_at.localeCompare(b.created_at);
      });

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
    let totalSkippedConflict = 0;
    const ruleUpdates: { ruleId: string; additionalMatches: number }[] = [];

    // PR2 — single multi-rule run per invocation, scoped to first company found.
    const firstUserId = [...rulesByUser.keys()][0] ?? null;
    const runId = firstUserId
      ? await createRun(supabaseAdmin, {
          rule_id: null,
          company_id: companyFilter,
          user_id: firstUserId,
          triggered_by: authHeader ? 'manual' : 'cron',
          mode: 'apply',
          metadata: { rules_count: rulesWithConditions.length },
        })
      : null;

    const allRunItems: RunItemInput[] = [];

    for (const [userId, userRules] of rulesByUser) {
      console.log(`[apply-all-automation-rules] Processing ${userRules.length} rules for user ${userId}`);

      const allTransactions = await transactionRepo.findUncategorized(
        companyFilter ? { companyId: companyFilter } : { userId },
      );

      console.log(`[apply-all-automation-rules] Found ${allTransactions.length} uncategorized transactions for user ${userId}`);
      if (allTransactions.length === 0) continue;

      // Two-pass: first detect candidates per rule, then resolve conflicts.
      const candidatesByTx = new Map<string, Array<{ rule: FullRule }>>();

      for (const rule of userRules) {
        const matchingTxs = (allTransactions as unknown as Transaction[]).filter(tx => {
          if (rule.company_id && tx.company_id !== rule.company_id) return false;
          return matchesRule(tx, rule);
        });
        for (const tx of matchingTxs) {
          const arr = candidatesByTx.get(tx.id) ?? [];
          arr.push({ rule });
          candidatesByTx.set(tx.id, arr);
        }
      }

      // PR3 — conflict resolution: if top-2 candidates have specificity within
      // threshold, skip and log as conflict instead of silently applying first.
      const transactionUpdates = new Map<string, { categoryId: string; rule: FullRule }>();
      const skipped: Array<{ tx: Transaction; rules: FullRule[] }> = [];
      for (const [txId, candidates] of candidatesByTx) {
        // candidates already arrive in priority/specificity order (rules pre-sorted).
        if (candidates.length >= 2) {
          const [a, b] = candidates;
          if (a.rule.target_category_id !== b.rule.target_category_id
              && isConflictingScore(a.rule.specificity_score, b.rule.specificity_score)) {
            const tx = (allTransactions as unknown as Transaction[]).find(t => t.id === txId);
            if (tx) skipped.push({ tx, rules: candidates.map(c => c.rule) });
            continue;
          }
        }
        const winning = candidates[0].rule;
        transactionUpdates.set(txId, { categoryId: winning.target_category_id, rule: winning });
      }

      // Aggregate rule update counters.
      const perRuleCount = new Map<string, number>();
      for (const [, { rule }] of transactionUpdates) {
        perRuleCount.set(rule.id, (perRuleCount.get(rule.id) ?? 0) + 1);
      }
      for (const [ruleId, count] of perRuleCount) {
        ruleUpdates.push({ ruleId, additionalMatches: count });
      }

      totalMatched += transactionUpdates.size + skipped.length;
      totalSkippedConflict += skipped.length;

      // Apply updates grouped by category.
      const updatesByCategory = new Map<string, string[]>();
      for (const [txId, { categoryId }] of transactionUpdates) {
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

      // Build run items snapshot (previous null since findUncategorized).
      for (const [txId, { categoryId, rule }] of transactionUpdates) {
        allRunItems.push({
          rule_id: rule.id,
          transaction_id: txId,
          previous_category_id: null,
          new_category_id: categoryId,
          confidence: 1,
          confidence_source: 'exact_rule',
          reason_codes: ['rule_matched'],
          evidence: { rule_name: rule.name, specificity: rule.specificity_score },
          status: 'applied',
        });
      }
      for (const { tx, rules: conflictingRules } of skipped) {
        allRunItems.push({
          rule_id: conflictingRules[0].id,
          transaction_id: tx.id,
          previous_category_id: tx.category_id ?? null,
          new_category_id: null,
          confidence: 0,
          confidence_source: 'exact_rule',
          reason_codes: ['conflict_specificity_close'],
          evidence: {
            competing_rules: conflictingRules.slice(0, 3).map(r => ({
              id: r.id, name: r.name, specificity: r.specificity_score, target: r.target_category_id,
            })),
          },
          status: 'skipped_conflict',
        });
      }
    }

    if (runId) {
      await appendRunItems(supabaseAdmin, runId, allRunItems);
      await finishRun(supabaseAdmin, runId, {
        matched: totalMatched, applied: totalUpdated, skippedConflict: totalSkippedConflict,
      });
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
