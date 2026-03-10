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

    const body = await req.json().catch(() => ({}));
    const targetCompanyId = body.company_id as string | undefined;

    // Get companies to backfill (one or all)
    let companiesQuery = supabase
      .from('company_bridge_accounts')
      .select('company_id, bridge_account_id');
    
    if (targetCompanyId) {
      companiesQuery = companiesQuery.eq('company_id', targetCompanyId);
    }

    const { data: assignments, error: assignError } = await companiesQuery;
    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No companies with bridge accounts' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by company
    const companyAccounts = new Map<string, number[]>();
    for (const a of assignments) {
      const list = companyAccounts.get(a.company_id) || [];
      list.push(a.bridge_account_id);
      companyAccounts.set(a.company_id, list);
    }

    let totalSnapshots = 0;

    for (const [companyId, accountIds] of companyAccounts) {
      // Get the most recent snapshot for this company (our anchor)
      const { data: latestSnapshots, error: snapError } = await supabase
        .from('bank_balance_snapshots')
        .select('balance, snapshot_date, bridge_account_id')
        .eq('company_id', companyId)
        .in('bridge_account_id', accountIds)
        .order('snapshot_date', { ascending: false })
        .limit(accountIds.length * 2);

      if (snapError) {
        console.error(`[backfill] Error fetching snapshots for ${companyId}:`, snapError);
        continue;
      }

      // If no snapshots at all, try to use current bridge balance as anchor
      let anchorDate: string;
      let anchorBalance: number;

      if (latestSnapshots && latestSnapshots.length > 0) {
        // Use the latest snapshot date as anchor
        anchorDate = latestSnapshots[0].snapshot_date;
        // Sum all accounts for that date
        const dateSnapshots = latestSnapshots.filter(s => s.snapshot_date === anchorDate);
        anchorBalance = dateSnapshots.reduce((sum, s) => sum + Number(s.balance), 0);
      } else {
        // No snapshots - use current bridge account balances
        const { data: accounts, error: accError } = await supabase
          .from('bridge_accounts')
          .select('balance')
          .in('bridge_account_id', accountIds)
          .eq('status', 'active');

        if (accError || !accounts || accounts.length === 0) {
          console.info(`[backfill] No anchor for company ${companyId}, skipping`);
          continue;
        }

        anchorBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
        const today = new Date();
        anchorDate = today.toISOString().split('T')[0];
      }

      // Fetch ALL transactions for this company (non-ignored, non-deleted)
      // ordered by date descending for backward walk
      let allTx: { amount: number; date: string; type: string }[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: txError } = await supabase
          .from('transactions')
          .select('amount, date, type')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .or('is_ignored.is.null,is_ignored.eq.false')
          .order('date', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (txError) {
          console.error(`[backfill] Error fetching transactions for ${companyId}:`, txError);
          break;
        }
        allTx = allTx.concat(batch || []);
        hasMore = (batch?.length ?? 0) === batchSize;
        offset += batchSize;
      }

      if (allTx.length === 0) {
        console.info(`[backfill] No transactions for company ${companyId}, skipping`);
        continue;
      }

      // Determine the range: from the earliest transaction month to the anchor date month
      const earliestTxDate = allTx[0].date;
      const earliestMonth = earliestTxDate.substring(0, 7); // YYYY-MM

      const anchorMonth = anchorDate.substring(0, 7); // YYYY-MM

      // Build monthly net movements map
      const monthlyNet = new Map<string, number>();
      for (const tx of allTx) {
        const monthKey = tx.date.substring(0, 7); // YYYY-MM
        const amount = Number(tx.amount);
        const net = tx.type === 'income' ? amount : -amount;
        monthlyNet.set(monthKey, (monthlyNet.get(monthKey) || 0) + net);
      }

      // Walk backward from anchor to generate 1st-of-month snapshots
      // anchor balance is balance AT anchorDate
      // We need: snapshot at 1st of anchor month = anchorBalance - transactions from 1st to anchorDate
      
      // Calculate net from 1st of anchor month to anchor date
      const anchorMonthFirst = anchorMonth + '-01';
      let netFromFirstToAnchor = 0;
      for (const tx of allTx) {
        if (tx.date >= anchorMonthFirst && tx.date <= anchorDate) {
          const amount = Number(tx.amount);
          netFromFirstToAnchor += tx.type === 'income' ? amount : -amount;
        }
      }

      // Balance at 1st of anchor month
      let balanceAtFirst = anchorBalance - netFromFirstToAnchor;

      // Now walk backwards month by month, generating snapshots
      const snapshots: { company_id: string; bridge_account_id: number; balance: number; snapshot_date: string }[] = [];

      // Use the first bridge account id for the aggregated snapshot
      const primaryAccountId = accountIds[0];

      // Generate snapshot for anchor month 1st
      let currentMonth = new Date(anchorMonthFirst + 'T00:00:00Z');
      
      // Walk backwards
      const earliestDate = new Date(earliestMonth + '-01T00:00:00Z');
      
      while (currentMonth >= earliestDate) {
        const dateStr = currentMonth.toISOString().split('T')[0];
        
        snapshots.push({
          company_id: companyId,
          bridge_account_id: primaryAccountId,
          balance: Math.round(balanceAtFirst * 100) / 100,
          snapshot_date: dateStr,
        });

        // Move to previous month
        currentMonth.setUTCMonth(currentMonth.getUTCMonth() - 1);
        const prevMonthKey = currentMonth.toISOString().substring(0, 7);
        const prevMonthNet = monthlyNet.get(prevMonthKey) || 0;
        
        // Balance at start of prev month = balance at start of current month - net of prev month
        balanceAtFirst = balanceAtFirst - prevMonthNet;
      }

      if (snapshots.length > 0) {
        // Upsert all snapshots (won't overwrite existing ones if they have different bridge_account_id)
        const { error: upsertError } = await supabase
          .from('bank_balance_snapshots')
          .upsert(snapshots, {
            onConflict: 'bridge_account_id,snapshot_date',
          });

        if (upsertError) {
          console.error(`[backfill] Upsert error for ${companyId}:`, upsertError);
        } else {
          totalSnapshots += snapshots.length;
          console.info(`[backfill] Created ${snapshots.length} snapshots for company ${companyId}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, totalSnapshots }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[backfill-snapshots] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
