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

    // Fetch all active bridge accounts with their balances
    const { data: accounts, error: fetchError } = await supabase
      .from('bridge_accounts')
      .select('bridge_account_id, company_id, balance')
      .eq('status', 'active');

    if (fetchError) {
      console.error('[snapshot-balances] Fetch error:', fetchError);
      throw fetchError;
    }

    if (!accounts || accounts.length === 0) {
      console.info('[snapshot-balances] No active accounts found');
      return new Response(JSON.stringify({ success: true, snapshots: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert snapshots for today (one per account)
    const snapshots = accounts.map((acc) => ({
      bridge_account_id: acc.bridge_account_id,
      company_id: acc.company_id,
      balance: acc.balance ?? 0,
      snapshot_date: today,
    }));

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
