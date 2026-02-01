import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RuleCondition {
  id: string;
  rule_id: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

interface AutomationRule {
  id: string;
  target_category_id: string;
  user_id: string;
  company_id: string | null;
  match_count: number;
  is_active: boolean;
  conditions: RuleCondition[];
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
  user_id: string;
  company_id: string | null;
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
function matchesRule(transaction: Transaction, conditions: RuleCondition[]): boolean {
  if (!conditions || conditions.length === 0) return false;
  return conditions.every(condition => matchCondition(transaction, condition));
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a user-initiated request (with auth) or a cron job
    const authHeader = req.headers.get('Authorization');
    let userFilter: string | null = null;
    let companyFilter: string | null = null;

    if (authHeader) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);

      if (!claimsError && claimsData?.claims) {
        userFilter = claimsData.claims.sub as string;
        
        // Try to get company_id from request body
        try {
          const body = await req.json();
          companyFilter = body.company_id || null;
        } catch {
          // No body or invalid JSON
        }
        
        console.log(`[apply-all-automation-rules] User-initiated: ${userFilter}, company: ${companyFilter || 'all'}`);
      }
    }

    // 1. Fetch all active automation rules
    let rulesQuery = supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('is_active', true)
      .not('target_category_id', 'is', null);

    if (userFilter) {
      rulesQuery = rulesQuery.eq('user_id', userFilter);
      if (companyFilter) {
        rulesQuery = rulesQuery.or(`company_id.eq.${companyFilter},company_id.is.null`);
      }
    }

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) {
      console.error('[apply-all-automation-rules] Error fetching rules:', rulesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch rules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rules || rules.length === 0) {
      console.log('[apply-all-automation-rules] No active rules found');
      return new Response(
        JSON.stringify({ message: 'No active rules', matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[apply-all-automation-rules] Found ${rules.length} active rules`);

    // 2. Fetch all conditions for these rules
    const ruleIds = rules.map(r => r.id);
    const { data: allConditions, error: conditionsError } = await supabaseAdmin
      .from('automation_rule_conditions')
      .select('*')
      .in('rule_id', ruleIds);

    if (conditionsError) {
      console.error('[apply-all-automation-rules] Error fetching conditions:', conditionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch conditions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group conditions by rule_id
    const conditionsByRule = new Map<string, RuleCondition[]>();
    for (const condition of (allConditions || [])) {
      const ruleConditions = conditionsByRule.get(condition.rule_id) || [];
      ruleConditions.push(condition as RuleCondition);
      conditionsByRule.set(condition.rule_id, ruleConditions);
    }

    // Create rules with conditions
    const rulesWithConditions: AutomationRule[] = rules
      .map(rule => ({
        ...rule,
        conditions: conditionsByRule.get(rule.id) || []
      }))
      .filter(rule => rule.conditions.length > 0) as AutomationRule[];

    console.log(`[apply-all-automation-rules] ${rulesWithConditions.length} rules have conditions`);

    if (rulesWithConditions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No rules with conditions', matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group rules by user_id for efficient processing
    const rulesByUser = new Map<string, AutomationRule[]>();
    for (const rule of rulesWithConditions) {
      const userId = rule.user_id;
      if (!rulesByUser.has(userId)) {
        rulesByUser.set(userId, []);
      }
      rulesByUser.get(userId)!.push(rule);
    }

    let totalMatched = 0;
    let totalUpdated = 0;
    const ruleUpdates: { ruleId: string; additionalMatches: number }[] = [];

    // Process each user's rules
    for (const [userId, userRules] of rulesByUser) {
      console.log(`[apply-all-automation-rules] Processing ${userRules.length} rules for user ${userId}`);

      // Fetch uncategorized transactions for this user (paginated)
      let allTransactions: Transaction[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let txQuery = supabaseAdmin
          .from('transactions')
          .select('id, description, amount, type, category_id, user_id, company_id')
          .eq('user_id', userId)
          .is('category_id', null)
          .is('deleted_at', null)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (companyFilter) {
          txQuery = txQuery.eq('company_id', companyFilter);
        }

        const { data: batch, error: txError } = await txQuery;

        if (txError) {
          console.error(`[apply-all-automation-rules] Error fetching transactions for user ${userId}:`, txError);
          break;
        }

        if (batch && batch.length > 0) {
          allTransactions = allTransactions.concat(batch as Transaction[]);
          hasMore = batch.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`[apply-all-automation-rules] Found ${allTransactions.length} uncategorized transactions for user ${userId}`);

      if (allTransactions.length === 0) continue;

      // Apply rules to transactions
      const transactionUpdates = new Map<string, string>(); // transaction_id -> category_id

      for (const rule of userRules) {
        const matchingTxs = allTransactions.filter(tx => {
          // Skip if already categorized by another rule in this batch
          if (transactionUpdates.has(tx.id)) return false;
          
          // Check company match if rule has company_id
          if (rule.company_id && tx.company_id !== rule.company_id) return false;
          
          return matchesRule(tx, rule.conditions);
        });

        for (const tx of matchingTxs) {
          transactionUpdates.set(tx.id, rule.target_category_id);
        }

        if (matchingTxs.length > 0) {
          ruleUpdates.push({ ruleId: rule.id, additionalMatches: matchingTxs.length });
          console.log(`[apply-all-automation-rules] Rule "${rule.id}" matched ${matchingTxs.length} transactions`);
        }
      }

      totalMatched += transactionUpdates.size;

      // Apply updates in batches, grouped by category
      const updatesByCategory = new Map<string, string[]>();
      for (const [txId, categoryId] of transactionUpdates) {
        if (!updatesByCategory.has(categoryId)) {
          updatesByCategory.set(categoryId, []);
        }
        updatesByCategory.get(categoryId)!.push(txId);
      }

      for (const [categoryId, txIds] of updatesByCategory) {
        const batches = chunkArray(txIds, 100);
        for (const batch of batches) {
          const { error: updateError } = await supabaseAdmin
            .from('transactions')
            .update({ category_id: categoryId })
            .in('id', batch);

          if (updateError) {
            console.error('[apply-all-automation-rules] Error updating batch:', updateError);
          } else {
            totalUpdated += batch.length;
          }
        }
      }
    }

    // Update match_count for each rule
    for (const { ruleId, additionalMatches } of ruleUpdates) {
      const rule = rules.find(r => r.id === ruleId);
      if (rule) {
        await supabaseAdmin
          .from('automation_rules')
          .update({ match_count: (rule.match_count || 0) + additionalMatches })
          .eq('id', ruleId);
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
