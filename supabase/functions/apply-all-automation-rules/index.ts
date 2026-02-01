import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationRule {
  id: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  target_category_id: string;
  user_id: string;
  company_id: string | null;
  match_count: number;
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

function matchesRule(transaction: Transaction, rule: AutomationRule): boolean {
  const { condition_field, condition_operator, condition_value } = rule;
  
  let fieldValue: string | number;
  
  switch (condition_field) {
    case 'description':
      fieldValue = transaction.description.toLowerCase();
      break;
    case 'amount':
      fieldValue = Math.abs(transaction.amount);
      break;
    case 'type':
      fieldValue = transaction.type;
      break;
    default:
      return false;
  }

  const compareValue = condition_field === 'amount' 
    ? parseFloat(condition_value) 
    : condition_value.toLowerCase();

  switch (condition_operator) {
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(compareValue as string);
    case 'equals':
      return fieldValue === compareValue || 
        (typeof fieldValue === 'string' && fieldValue === (compareValue as string));
    case 'starts_with':
      return typeof fieldValue === 'string' && fieldValue.startsWith(compareValue as string);
    case 'ends_with':
      return typeof fieldValue === 'string' && fieldValue.endsWith(compareValue as string);
    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > (compareValue as number);
    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < (compareValue as number);
    default:
      return false;
  }
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

    // Group rules by user_id for efficient processing
    const rulesByUser = new Map<string, AutomationRule[]>();
    for (const rule of rules) {
      const userId = rule.user_id;
      if (!rulesByUser.has(userId)) {
        rulesByUser.set(userId, []);
      }
      rulesByUser.get(userId)!.push(rule as AutomationRule);
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
          
          return matchesRule(tx, rule);
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
        rules_processed: rules.length,
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
