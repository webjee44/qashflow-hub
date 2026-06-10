import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import {
  applyAutomationRulesForCompany,
  TenantSecurityError,
} from '../_shared/automationRuleEngine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// `company_id` made required: it is the only way the orchestrator can enforce
// tenant security. Legacy clients sending only `rule_id` are handled with a
// resolution lookup below (the rule's own company_id is authoritative).
const requestSchema = z.object({
  rule_id: z.string().uuid(),
  company_id: z.string().uuid().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let companyId = parsed.data.company_id ?? null;
    if (!companyId) {
      const { data: rule } = await supabaseAdmin
        .from('automation_rules')
        .select('company_id')
        .eq('id', parsed.data.rule_id)
        .maybeSingle();
      if (!rule?.company_id) return json({ error: 'Rule not found or has no company' }, 404);
      companyId = rule.company_id as string;
    }

    const result = await applyAutomationRulesForCompany({
      client: supabaseAdmin,
      companyId,
      userId: user.id,
      triggeredBy: 'manual',
      ruleId: parsed.data.rule_id,
      dryRun: false,
    });

    return json({
      matched: result.matched,
      updated: result.applied,
      skipped_conflict: result.skippedConflict,
      run_id: result.runId,
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return json({ error: err.message }, err.status);
    }
    console.error('[apply-automation-rule] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
