import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import {
  previewRule,
  TenantSecurityError,
} from '../_shared/automationRuleEngine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const conditionSchema = z.object({
  condition_field: z.string().min(1),
  condition_operator: z.string().min(1),
  condition_value: z.string(),
});

const requestSchema = z.object({
  conditions: z.array(conditionSchema).min(1),
  target_category_id: z.string().uuid().nullable(),
  company_id: z.string().uuid(),
  rule_id_being_edited: z.string().uuid().nullable().optional(),
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

    const result = await previewRule({
      client: supabaseAdmin,
      companyId: parsed.data.company_id,
      userId: user.id,
      triggeredBy: 'manual',
      conditions: parsed.data.conditions,
      target_category_id: parsed.data.target_category_id,
      rule_id_being_edited: parsed.data.rule_id_being_edited ?? null,
    });

    return json(result);
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return json({ error: err.message }, err.status);
    }
    console.error('[automation-rule-preview] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
