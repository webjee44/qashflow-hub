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

    // Client admin pour les updates
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { rule_id } = await req.json();
    
    if (!rule_id) {
      return new Response(
        JSON.stringify({ error: 'Missing rule_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Applying rule ${rule_id} for user ${user.id}`);

    // Récupérer la règle
    const { data: rule, error: ruleError } = await supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('id', rule_id)
      .eq('user_id', user.id)
      .single();

    if (ruleError || !rule) {
      console.error('Rule not found:', ruleError);
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
      console.error('Error fetching transactions:', txError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${transactions?.length || 0} uncategorized transactions`);

    // Trouver les transactions qui matchent la règle
    const matchingTransactions = (transactions || []).filter(tx => 
      matchesRule(tx as Transaction, rule as AutomationRule)
    );

    console.log(`${matchingTransactions.length} transactions match the rule`);

    if (matchingTransactions.length === 0) {
      return new Response(
        JSON.stringify({ matched: 0, updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mettre à jour les transactions
    const transactionIds = matchingTransactions.map(tx => tx.id);
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ category_id: rule.target_category_id })
      .in('id', transactionIds);

    if (updateError) {
      console.error('Error updating transactions:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Incrémenter le match_count
    const { error: countError } = await supabaseAdmin
      .from('automation_rules')
      .update({ match_count: (rule.match_count || 0) + matchingTransactions.length })
      .eq('id', rule_id);

    if (countError) {
      console.error('Error updating match count:', countError);
    }

    console.log(`Successfully updated ${matchingTransactions.length} transactions`);

    return new Response(
      JSON.stringify({ 
        matched: matchingTransactions.length, 
        updated: matchingTransactions.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apply-automation-rule:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
