import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== Zod Schema for request validation ==========
const automationRuleRequestSchema = z.object({
  rule_id: z.string().uuid('rule_id doit être un UUID valide'),
});

interface RuleCondition {
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

interface AutomationRule {
  id: string;
  target_category_id: string;
  user_id: string;
  match_count: number;
  // Primary condition from automation_rules table
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  // Additional conditions
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
  const { condition_field, condition_operator, condition_value } = condition;
  
  switch (condition_field) {
    case 'description': {
      const fieldValue = transaction.description.toLowerCase();
      const compareValue = condition_value.toLowerCase();
      
      switch (condition_operator) {
        case 'contains':
          return fieldValue.includes(compareValue);
        case 'equals':
          return fieldValue === compareValue;
        case 'starts_with':
          return fieldValue.startsWith(compareValue);
        case 'ends_with':
          return fieldValue.endsWith(compareValue);
        default:
          return false;
      }
    }
    
    case 'amount': {
      const amount = Math.abs(transaction.amount);
      const value = parseFloat(condition_value);
      
      switch (condition_operator) {
        case 'equals':
          // Tolerance of 0.01 for rounding
          return Math.abs(amount - value) < 0.01;
        case 'greater_than':
          return amount > value;
        case 'less_than':
          return amount < value;
        case 'between': {
          try {
            const { min, max } = JSON.parse(condition_value);
            return amount >= min && amount <= max;
          } catch {
            return false;
          }
        }
        default:
          return false;
      }
    }
    
    case 'type':
      return transaction.type === condition_value;
    
    default:
      return false;
  }
}

// Check if transaction matches ALL conditions (AND logic)
function matchesRule(transaction: Transaction, rule: AutomationRule): boolean {
  // First check the primary condition from the rule itself
  const primaryCondition: RuleCondition = {
    condition_field: rule.condition_field,
    condition_operator: rule.condition_operator,
    condition_value: rule.condition_value,
  };
  
  if (!matchCondition(transaction, primaryCondition)) {
    return false;
  }
  
  // Then check any additional conditions (AND logic)
  if (rule.extra_conditions && rule.extra_conditions.length > 0) {
    return rule.extra_conditions.every(condition => matchCondition(transaction, condition));
  }
  
  return true;
}

// Helper to chunk array into smaller batches
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

    // Client avec le token de l'utilisateur pour vérifier l'auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Vérifier l'utilisateur
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body JSON invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = automationRuleRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const errors = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      console.error('[apply-automation-rule] Validation error:', errors);
      return new Response(
        JSON.stringify({ error: `Validation échouée: ${errors}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { rule_id } = validation.data;
    console.log(`[apply-automation-rule] Applying rule ${rule_id} for user ${user.id}`);

    // Client admin pour les updates
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer la règle with its primary condition
    const { data: rule, error: ruleError } = await supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('id', rule_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (ruleError) {
      console.error('[apply-automation-rule] Error fetching rule:', ruleError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch rule' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rule) {
      console.error('[apply-automation-rule] Rule not found');
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

    // Check that rule has valid primary condition
    if (!rule.condition_field || !rule.condition_operator || !rule.condition_value) {
      console.log('[apply-automation-rule] Rule has no valid primary condition');
      return new Response(
        JSON.stringify({ matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch any additional conditions for this rule
    const { data: extraConditions, error: conditionsError } = await supabaseAdmin
      .from('automation_rule_conditions')
      .select('*')
      .eq('rule_id', rule_id);

    if (conditionsError) {
      console.error('[apply-automation-rule] Error fetching conditions:', conditionsError);
      // Continue anyway - extra conditions are optional
    }

    // Build the full rule object
    const fullRule: AutomationRule = {
      id: rule.id,
      target_category_id: rule.target_category_id,
      user_id: rule.user_id,
      match_count: rule.match_count || 0,
      condition_field: rule.condition_field,
      condition_operator: rule.condition_operator,
      condition_value: rule.condition_value,
      extra_conditions: (extraConditions || []).map(c => ({
        condition_field: c.condition_field,
        condition_operator: c.condition_operator,
        condition_value: c.condition_value,
      })),
    };

    console.log(`[apply-automation-rule] Rule: ${fullRule.condition_field} ${fullRule.condition_operator} "${fullRule.condition_value}", plus ${fullRule.extra_conditions.length} extra conditions`);

    // Récupérer TOUTES les transactions NON catégorisées de l'utilisateur (paginé pour dépasser la limite de 1000)
    let allTransactions: Transaction[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: txError } = await supabaseAdmin
        .from('transactions')
        .select('id, description, amount, type, category_id')
        .eq('user_id', user.id)
        .is('category_id', null)
        .is('deleted_at', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (txError) {
        console.error('[apply-automation-rule] Error fetching transactions page:', page, txError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch transactions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (batch && batch.length > 0) {
        allTransactions = allTransactions.concat(batch as Transaction[]);
        hasMore = batch.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    const transactions = allTransactions;
    console.log(`[apply-automation-rule] Found ${transactions.length} uncategorized transactions (${page} pages)`);

    // Trouver les transactions qui matchent la règle (primary + extra conditions)
    const matchingTransactions = (transactions || []).filter(tx => 
      matchesRule(tx as Transaction, fullRule)
    );

    console.log(`[apply-automation-rule] ${matchingTransactions.length} transactions match the rule`);

    if (matchingTransactions.length === 0) {
      return new Response(
        JSON.stringify({ matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mettre à jour les transactions par lots de 100 pour éviter les limites d'URL
    const transactionIds = matchingTransactions.map(tx => tx.id);
    const batches = chunkArray(transactionIds, 100);
    let totalUpdated = 0;

    console.log(`[apply-automation-rule] Updating ${transactionIds.length} transactions in ${batches.length} batches`);

    for (const batch of batches) {
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({ category_id: rule.target_category_id })
        .in('id', batch);

      if (updateError) {
        console.error('[apply-automation-rule] Error updating batch:', updateError);
        // Continue with other batches even if one fails
      } else {
        totalUpdated += batch.length;
        console.log(`[apply-automation-rule] Updated batch of ${batch.length} transactions`);
      }
    }

    // Incrémenter le match_count
    const { error: countError } = await supabaseAdmin
      .from('automation_rules')
      .update({ match_count: (rule.match_count || 0) + totalUpdated })
      .eq('id', rule_id);

    if (countError) {
      console.error('[apply-automation-rule] Error updating match count:', countError);
    }

    console.log(`[apply-automation-rule] Successfully updated ${totalUpdated} transactions`);

    return new Response(
      JSON.stringify({ 
        matched: matchingTransactions.length, 
        updated: totalUpdated 
      }),
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
