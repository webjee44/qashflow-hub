import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createSupabaseServices } from '../_shared/serviceFactory.ts';
import {
  computePreview,
  type PreviewCondition,
  type PreviewExistingRule,
  type PreviewTransaction,
} from '../_shared/automationPreviewCore.ts';

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

interface TxRow {
  id: string;
  description: string | null;
  amount: number | string | null;
  type: string | null;
  category_id: string | null;
  bank_account_name: string | null;
  date: string | null;
  merchant_key: string | null;
  normalized_description: string | null;
}

interface RuleRow {
  id: string;
  name: string;
  target_category_id: string | null;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues.map((i) => i.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { conditions, target_category_id, company_id, rule_id_being_edited } = parsed.data;

    const { supabaseAdmin } = createSupabaseServices();

    // Verify access via the user-scoped client (RLS enforces has_company_access).
    const { data: companyAccess, error: companyError } = await supabaseUser
      .from('companies')
      .select('id')
      .eq('id', company_id)
      .maybeSingle();

    if (companyError || !companyAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Target category type for type-guard awareness.
    let targetCategoryType: 'income' | 'expense' | null = null;
    if (target_category_id) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('type')
        .eq('id', target_category_id)
        .maybeSingle();
      if (cat?.type === 'income' || cat?.type === 'expense') {
        targetCategoryType = cat.type;
      }
    }

    // Fetch ALL non-deleted transactions for the company (categorized + uncategorized).
    // Paginated to bypass the 1000-row Supabase default.
    const pageSize = 1000;
    let page = 0;
    const transactions: PreviewTransaction[] = [];
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('id, description, amount, type, category_id, bank_account_name, date, merchant_key, normalized_description')
        .eq('company_id', company_id)
        .is('deleted_at', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data as TxRow[]) {
        transactions.push({
          id: row.id,
          description: row.description ?? '',
          amount: row.amount ?? 0,
          type: row.type ?? '',
          category_id: row.category_id,
          bank_account_name: row.bank_account_name,
          date: row.date,
          merchant_key: row.merchant_key,
          normalized_description: row.normalized_description,
        });
      }
      if (data.length < pageSize) break;
      page++;
    }

    // Fetch all other active rules for conflict detection.
    const { data: otherRulesData } = await supabaseAdmin
      .from('automation_rules')
      .select('id, name, target_category_id, condition_field, condition_operator, condition_value')
      .eq('company_id', company_id)
      .eq('is_active', true);

    const otherRules: PreviewExistingRule[] = [];
    if (otherRulesData && otherRulesData.length > 0) {
      const ruleIds = (otherRulesData as RuleRow[]).map((r) => r.id);
      const { data: extraConds } = await supabaseAdmin
        .from('automation_rule_conditions')
        .select('rule_id, condition_field, condition_operator, condition_value')
        .in('rule_id', ruleIds);

      const condsByRule = new Map<string, PreviewCondition[]>();
      for (const c of (extraConds || []) as Array<{ rule_id: string } & PreviewCondition>) {
        const arr = condsByRule.get(c.rule_id) || [];
        arr.push({
          condition_field: c.condition_field,
          condition_operator: c.condition_operator,
          condition_value: c.condition_value,
        });
        condsByRule.set(c.rule_id, arr);
      }

      for (const r of otherRulesData as RuleRow[]) {
        const extras = condsByRule.get(r.id);
        const cs: PreviewCondition[] = extras && extras.length > 0
          ? extras
          : [{
              condition_field: r.condition_field,
              condition_operator: r.condition_operator,
              condition_value: r.condition_value,
            }];
        otherRules.push({
          id: r.id,
          name: r.name,
          target_category_id: r.target_category_id,
          conditions: cs,
        });
      }
    }

    const result = computePreview(
      {
        conditions,
        target_category_id,
        target_category_type: targetCategoryType,
        rule_id_being_edited: rule_id_being_edited ?? null,
      },
      transactions,
      otherRules,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[automation-rule-preview] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
