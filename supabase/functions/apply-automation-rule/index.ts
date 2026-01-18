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

interface AutomationRule {
  id: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  target_category_id: string;
  user_id: string;
  match_count: number;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
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

    // Récupérer la règle
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

    // Récupérer les transactions NON catégorisées de l'utilisateur
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, description, amount, type, category_id')
      .eq('user_id', user.id)
      .is('category_id', null);

    if (txError) {
      console.error('[apply-automation-rule] Error fetching transactions:', txError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[apply-automation-rule] Found ${transactions?.length || 0} uncategorized transactions`);

    // Trouver les transactions qui matchent la règle
    const matchingTransactions = (transactions || []).filter(tx => 
      matchesRule(tx as Transaction, rule as AutomationRule)
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
