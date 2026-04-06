import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createSupabaseServices } from '../_shared/serviceFactory.ts';
import { type RuleCondition } from '../_shared/repositories/AutomationRepository.ts';
import { matchesAutomationCondition } from '../../../shared/automationRuleMatchingCore.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== Zod Schema for request validation ==========
const automationRuleRequestSchema = z.object({
  rule_id: z.string().uuid('rule_id doit être un UUID valide'),
});

interface FullRule {
  id: string;
  target_category_id: string;
  target_category_type: string;
  user_id: string;
  match_count: number;
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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rawBody;
    try { rawBody = await req.json(); } catch {
      return new Response(
        JSON.stringify({ error: 'Body JSON invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = automationRuleRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const errors = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return new Response(
        JSON.stringify({ error: `Validation échouée: ${errors}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { rule_id } = validation.data;
    console.log(`[apply-automation-rule] Applying rule ${rule_id} for user ${user.id}`);

    const { automationRepo, transactionRepo } = createSupabaseServices();

    // Fetch the rule
    const rule = await automationRepo.findById(rule_id);

    if (!rule) {
      return new Response(
        JSON.stringify({ error: 'Rule not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rule.target_category_id) {
      return new Response(
        JSON.stringify({ error: 'Rule has no target category', matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rule.condition_field || !rule.condition_operator || !rule.condition_value) {
      return new Response(
        JSON.stringify({ matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch target category type for type guard
    const { supabaseAdmin } = createSupabaseServices();
    const { data: targetCategory } = await supabaseAdmin
      .from('categories')
      .select('type')
      .eq('id', rule.target_category_id)
      .maybeSingle();

    // Fetch extra conditions
    const extraConditionsRaw = await automationRepo.findConditionsByRuleIds([rule_id]);

    const fullRule: FullRule = {
      id: rule.id,
      target_category_id: rule.target_category_id,
      target_category_type: targetCategory?.type || '',
      user_id: rule.user_id,
      match_count: rule.match_count || 0,
      condition_field: rule.condition_field,
      condition_operator: rule.condition_operator,
      condition_value: rule.condition_value,
      extra_conditions: extraConditionsRaw.map(c => ({
        condition_field: c.condition_field,
        condition_operator: c.condition_operator,
        condition_value: c.condition_value,
      })),
    };

    console.log(`[apply-automation-rule] Rule: ${fullRule.condition_field} ${fullRule.condition_operator} "${fullRule.condition_value}", plus ${fullRule.extra_conditions.length} extra conditions`);

    // Fetch uncategorized transactions via repository
    const filter = rule.company_id
      ? { companyId: rule.company_id }
      : { userId: rule.user_id };

    const transactions = await transactionRepo.findUncategorized(filter);
    console.log(`[apply-automation-rule] Found ${transactions.length} uncategorized transactions`);

    // Match
    const matchingTransactions = transactions.filter(tx =>
      matchesRule(tx as unknown as Transaction, fullRule)
    );

    console.log(`[apply-automation-rule] ${matchingTransactions.length} transactions match the rule`);

    if (matchingTransactions.length === 0) {
      return new Response(
        JSON.stringify({ matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update in batches via repository
    const transactionIds = matchingTransactions.map(tx => (tx as any).id as string);
    const batches = chunkArray(transactionIds, 100);
    let totalUpdated = 0;

    for (const batch of batches) {
      try {
        await transactionRepo.bulkUpdateCategory(batch, rule.target_category_id);
        totalUpdated += batch.length;
      } catch (err) {
        console.error('[apply-automation-rule] Error updating batch:', err);
      }
    }

    // Update match count
    await automationRepo.updateMatchCount(rule_id, (rule.match_count || 0) + totalUpdated);

    console.log(`[apply-automation-rule] Successfully updated ${totalUpdated} transactions`);

    return new Response(
      JSON.stringify({ matched: matchingTransactions.length, updated: totalUpdated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[apply-automation-rule] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
