// ============================================
// apply-intercompany-categorization — Edge function
// Applique la catégorisation standard « C/C <société d'en face> » aux jambes
// non catégorisées des liens intercompany (auto_matched / confirmed).
//
// Modes d'appel:
//  - { link_ids: [...] } : cible une liste précise (usage: confirmation UI)
//  - {}                  : backfill sur tous les liens éligibles
//
// Idempotent : ne remplace jamais une catégorie existante (filtre is('category_id', null)).
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { categorizeIntercompanyLinks } from '../_shared/intercompany/categorizeLinks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  link_ids?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body: RequestBody =
    req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const linkIds =
    Array.isArray(body.link_ids) && body.link_ids.length > 0 ? body.link_ids : undefined;

  try {
    const result = await categorizeIntercompanyLinks(client, linkIds);
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[apply-intercompany-categorization] error:', err);
    // Trace visible dans intercompany_match_runs pour respecter la doctrine
    // « zéro échec silencieux ».
    try {
      await client.from('intercompany_match_runs' as any).insert({
        mode: 'incremental',
        triggered_by: 'apply_categorization',
        status: 'failed',
        candidates_scanned: 0,
        auto_matched: 0,
        suggested: 0,
        inserted: 0,
        skipped_existing: 0,
        windows_processed: 0,
        error_message: msg,
        details: { link_ids: linkIds ?? null },
      } as any);
    } catch (_) { /* noop */ }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
