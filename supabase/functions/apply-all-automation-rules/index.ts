import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  applyAutomationRulesForCompany,
  TenantSecurityError,
  type EngineTriggeredBy,
} from '../_shared/automationRuleEngine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let body: { company_id?: string } = {};
    try { body = await req.json(); } catch { /* allow empty body for cron */ }

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let triggeredBy: EngineTriggeredBy = 'cron';

    if (authHeader) {
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        userId = user.id;
        triggeredBy = 'manual';
      }
    }

    // Resolve target companies. For manual / explicit calls we require a single
    // company_id. For cron without auth, iterate over every company that has
    // at least one active rule.
    let companyIds: string[] = [];
    if (body.company_id) {
      companyIds = [body.company_id];
    } else if (triggeredBy === 'manual') {
      return json({ error: 'company_id is required' }, 400);
    } else {
      const { data: rules, error } = await supabaseAdmin
        .from('automation_rules')
        .select('company_id')
        .eq('is_active', true)
        .not('company_id', 'is', null);
      if (error) throw error;
      companyIds = [...new Set((rules || []).map((r: any) => r.company_id))];
    }

    let totalMatched = 0;
    let totalUpdated = 0;
    let totalSkippedConflict = 0;
    const perCompany: Array<{ company_id: string; matched: number; applied: number }> = [];

    for (const cid of companyIds) {
      try {
        const result = await applyAutomationRulesForCompany({
          client: supabaseAdmin,
          companyId: cid,
          userId,
          triggeredBy,
          dryRun: false,
        });
        totalMatched += result.matched;
        totalUpdated += result.applied;
        totalSkippedConflict += result.skippedConflict;
        perCompany.push({ company_id: cid, matched: result.matched, applied: result.applied });
      } catch (companyErr) {
        if (companyErr instanceof TenantSecurityError) {
          return json({ error: companyErr.message }, companyErr.status);
        }
        console.error(`[apply-all-automation-rules] company ${cid} failed:`, companyErr);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[apply-all-automation-rules] ${companyIds.length} companies in ${duration}ms — ` +
        `matched=${totalMatched} updated=${totalUpdated} skipped=${totalSkippedConflict}`,
    );

    return json({
      success: true,
      companies_processed: companyIds.length,
      matched: totalMatched,
      updated: totalUpdated,
      skipped_conflict: totalSkippedConflict,
      duration_ms: duration,
      per_company: perCompany,
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return json({ error: err.message }, err.status);
    }
    console.error('[apply-all-automation-rules] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
