import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    // Use company_bridge_accounts as source of truth for account-company mapping
    const { data: assignments, error: assignError } = await supabase
      .from('company_bridge_accounts')
      .select('company_id, bridge_account_id');

    if (assignError) {
      console.error('[snapshot-balances] Assignment fetch error:', assignError);
      throw assignError;
    }

    if (!assignments || assignments.length === 0) {
      console.info('[snapshot-balances] No account assignments found');
      return new Response(JSON.stringify({ success: true, snapshots: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all assigned bridge_account_ids
    const assignedIds = assignments.map(a => a.bridge_account_id);

    // Fetch balances for assigned accounts only
    const { data: accounts, error: fetchError } = await supabase
      .from('bridge_accounts')
      .select('bridge_account_id, balance')
      .in('bridge_account_id', assignedIds)
      .eq('status', 'active');

    if (fetchError) {
      console.error('[snapshot-balances] Fetch error:', fetchError);
      throw fetchError;
    }

    if (!accounts || accounts.length === 0) {
      console.info('[snapshot-balances] No active assigned accounts found');
      return new Response(JSON.stringify({ success: true, snapshots: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a map of bridge_account_id -> company_id from assignments
    const accountToCompany = new Map<number, string>();
    for (const a of assignments) {
      accountToCompany.set(a.bridge_account_id, a.company_id);
    }

    // Create snapshots using the company_id from assignments (not from bridge_accounts)
    const snapshots = accounts
      .filter(acc => accountToCompany.has(acc.bridge_account_id))
      .map((acc) => ({
        bridge_account_id: acc.bridge_account_id,
        company_id: accountToCompany.get(acc.bridge_account_id)!,
        balance: acc.balance ?? 0,
        snapshot_date: today,
      }));

    if (snapshots.length === 0) {
      console.info('[snapshot-balances] No snapshots to create');
      return new Response(JSON.stringify({ success: true, snapshots: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: upsertError, count } = await supabase
      .from('bank_balance_snapshots')
      .upsert(snapshots, {
        onConflict: 'bridge_account_id,snapshot_date',
        count: 'exact',
      });

    if (upsertError) {
      console.error('[snapshot-balances] Upsert error:', upsertError);
      throw upsertError;
    }

    console.info(`[snapshot-balances] Saved ${count ?? snapshots.length} snapshots for ${today}`);

    return new Response(
      JSON.stringify({ success: true, date: today, snapshots: count ?? snapshots.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[snapshot-balances] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
