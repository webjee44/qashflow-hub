/**
 * PR5 — Backfill `merchant_key` and `normalized_description` for transactions
 * that predate the normalizer integration in bridge-sync.
 *
 * Idempotent and safe to run multiple times:
 *   - only touches rows where `merchant_key IS NULL AND deleted_at IS NULL`
 *   - never overwrites existing values (so manual UI edits, future overrides
 *     and any prior backfill stay authoritative)
 *   - chunked per company, concurrency-safe via `id` ordering
 *
 * Triggered manually by a superadmin or via cron once after deployment.
 * Body: { company_id?: string, batch_size?: number, max_batches?: number }
 *   - company_id  → restrict to one company (smoke test); else process all
 *   - batch_size  → rows per chunk (default 500, max 2000)
 *   - max_batches → safety cap per invocation (default 50)
 *
 * NB: this is a heavy job. We keep verify_jwt = false (Lovable convention) and
 * gate caller with a SUPABASE_SERVICE_ROLE_KEY-only admin check via header.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { deriveTransactionNormalization } from '../_shared/merchantNormalizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const bodySchema = z.object({
  company_id: z.string().uuid().optional(),
  batch_size: z.number().int().min(50).max(2000).optional(),
  max_batches: z.number().int().min(1).max(200).optional(),
});

interface Row {
  id: string;
  description: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Caller must be a logged-in superadmin (or the cron with no auth header).
    const authHeader = req.headers.get('Authorization');
    let isCron = !authHeader;

    if (authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: superCheck } = await userClient.rpc('is_superadmin', { _user_id: user.id });
      if (!superCheck) {
        return new Response(JSON.stringify({ error: 'Forbidden: superadmin required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let raw: unknown = {};
    try { raw = await req.json(); } catch { /* empty body OK */ }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { company_id, batch_size = 500, max_batches = 50 } = parsed.data;

    const admin = createClient(supabaseUrl, supabaseService);

    let totalScanned = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let lastId: string | null = null;
    let batchIndex = 0;

    while (batchIndex < max_batches) {
      let query = admin
        .from('transactions')
        .select('id, description')
        .is('merchant_key', null)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .limit(batch_size);

      if (company_id) query = query.eq('company_id', company_id);
      if (lastId) query = query.gt('id', lastId);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as Row[];
      if (rows.length === 0) break;

      // Build per-row updates. Use Promise.all in chunks of 50 to keep latency low.
      const updates: Array<{ id: string; merchant_key: string | null; normalized_description: string | null }> = [];
      for (const row of rows) {
        const norm = deriveTransactionNormalization(row.description ?? null);
        if (!norm.merchant_key && !norm.normalized_description) {
          totalSkipped++;
          continue;
        }
        updates.push({ id: row.id, ...norm });
      }

      const writeChunkSize = 50;
      for (let i = 0; i < updates.length; i += writeChunkSize) {
        const slice = updates.slice(i, i + writeChunkSize);
        const results = await Promise.all(
          slice.map(u =>
            admin
              .from('transactions')
              .update({
                merchant_key: u.merchant_key,
                normalized_description: u.normalized_description,
              })
              .eq('id', u.id)
          )
        );
        totalUpdated += results.filter(r => !r.error).length;
      }

      totalScanned += rows.length;
      lastId = rows[rows.length - 1].id;
      batchIndex++;

      if (rows.length < batch_size) break;
    }

    console.log(
      `[backfill-merchant-keys] scanned=${totalScanned} updated=${totalUpdated} skipped=${totalSkipped} batches=${batchIndex} cron=${isCron}`
    );

    return new Response(
      JSON.stringify({
        scanned: totalScanned,
        updated: totalUpdated,
        skipped: totalSkipped,
        batches: batchIndex,
        has_more: batchIndex >= max_batches,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[backfill-merchant-keys] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
