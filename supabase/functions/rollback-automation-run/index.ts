import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const bodySchema = z.object({
  run_id: z.string().uuid(),
});

/**
 * PR2 — Rollback an automation run.
 *
 * Restores `previous_category_id` for every applied item, marks items
 * `status='rolled_back'`, marks the run rolled back, emits no destructive
 * write outside the transactions touched by this run.
 *
 * Skipped-conflict items are left untouched (they were never applied).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let raw;
    try { raw = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { run_id } = parsed.data;

    const admin = createClient(supabaseUrl, supabaseService);

    // Fetch run with access check via user client (RLS enforces it).
    const { data: run, error: runErr } = await userClient
      .from('automation_runs')
      .select('id, can_rollback, status, company_id, user_id, rule_id')
      .eq('id', run_id)
      .maybeSingle();
    if (runErr || !run) {
      return new Response(JSON.stringify({ error: 'Run not found or access denied' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!run.can_rollback) {
      return new Response(JSON.stringify({ error: 'Run cannot be rolled back' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (run.status === 'rolled_back') {
      return new Response(JSON.stringify({ error: 'Run already rolled back' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch applied items (skipped_conflict items have nothing to revert).
    const { data: items, error: itemsErr } = await admin
      .from('automation_run_items')
      .select('id, transaction_id, previous_category_id, new_category_id, status')
      .eq('run_id', run_id)
      .eq('status', 'applied');
    if (itemsErr) throw itemsErr;

    let reverted = 0;
    const now = new Date().toISOString();

    // Group by previous_category_id (NULL goes to its own bucket).
    const byPrev = new Map<string | null, string[]>();
    for (const it of items ?? []) {
      const key = it.previous_category_id;
      const arr = byPrev.get(key) ?? [];
      arr.push(it.transaction_id);
      byPrev.set(key, arr);
    }

    for (const [prevCat, txIds] of byPrev) {
      // Chunked update to stay within PostgREST limits.
      const chunkSize = 200;
      for (let i = 0; i < txIds.length; i += chunkSize) {
        const slice = txIds.slice(i, i + chunkSize);
        const { error } = await admin
          .from('transactions')
          .update({ category_id: prevCat })
          .in('id', slice);
        if (error) {
          console.error('[rollback-automation-run] Update batch failed:', error);
          continue;
        }
        reverted += slice.length;
      }
    }

    // Mark items rolled back.
    if ((items ?? []).length > 0) {
      const ids = (items ?? []).map(i => i.id);
      const chunkSize = 500;
      for (let i = 0; i < ids.length; i += chunkSize) {
        await admin
          .from('automation_run_items')
          .update({ status: 'rolled_back', rolled_back_at: now })
          .in('id', ids.slice(i, i + chunkSize));
      }
    }

    // Bump rule false_positive_count if single-rule run (rollback = signal négatif fort).
    if (run.rule_id) {
      const { data: ruleRow } = await admin
        .from('automation_rules')
        .select('false_positive_count, match_count')
        .eq('id', run.rule_id)
        .maybeSingle();
      if (ruleRow) {
        await admin
          .from('automation_rules')
          .update({
            false_positive_count: (ruleRow.false_positive_count ?? 0) + reverted,
            match_count: Math.max(0, (ruleRow.match_count ?? 0) - reverted),
            last_correction_at: now,
          })
          .eq('id', run.rule_id);
      }
    }

    await admin
      .from('automation_runs')
      .update({
        status: 'rolled_back',
        rolled_back_at: now,
        rolled_back_by: user.id,
        can_rollback: false,
      })
      .eq('id', run_id);

    return new Response(JSON.stringify({ run_id, reverted }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[rollback-automation-run] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
