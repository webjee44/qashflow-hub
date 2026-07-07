// ============================================
// match-intercompany — Edge function
// Détecte et persiste les paires de transactions intergroupes.
//
// Modes:
//  - 'backfill'    : parcourt tout l'historique par fenêtres mensuelles
//  - 'incremental' : depuis N jours (défaut 10)
//
// Doctrine "zéro échec silencieux" : toute erreur est persistée dans
// automation_runs (source: 'intercompany_match') pour être visible côté UI.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  matchIntercompanyTransfers,
  type IntercompanyTx,
  type CompanyAlias,
  type ExistingLink,
  type IntercompanyMatchDecision,
} from '../_shared/intercompany/matchIntercompanyTransfers.ts';
import { categorizeIntercompanyLinks } from '../_shared/intercompany/categorizeLinks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  mode?: 'backfill' | 'incremental';
  /** incremental only : fenêtre en jours (défaut 10) */
  since_days?: number;
  /** backfill only : date début YYYY-MM-DD */
  from?: string;
  /** min amount override */
  min_amount?: number;
}

interface RunSummary {
  windows_processed: number;
  candidates_scanned: number;
  auto_matched: number;
  suggested: number;
  inserted: number;
  skipped_existing: number;
  errors: string[];
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(y: number, m: number): Date {
  return new Date(Date.UTC(y, m, 1));
}

function monthWindows(startISO: string, endISO: string): Array<{ from: string; to: string }> {
  const start = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  const out: Array<{ from: string; to: string }> = [];
  let cursor = firstOfMonth(start.getUTCFullYear(), start.getUTCMonth());
  while (cursor <= end) {
    const next = firstOfMonth(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1);
    const to = new Date(next.getTime() - 86_400_000);
    out.push({
      from: isoDay(cursor < start ? start : cursor),
      to: isoDay(to > end ? end : to),
    });
    cursor = next;
  }
  return out;
}

async function loadAliases(client: ReturnType<typeof createClient>): Promise<CompanyAlias[]> {
  const { data: companies, error: cErr } = await client
    .from('companies')
    .select('id, name')
    .is('deleted_at', null);
  if (cErr) throw cErr;

  const { data: bankAccounts, error: bErr } = await client
    .from('bridge_accounts')
    .select('name, iban');
  if (bErr) throw bErr;

  // bank accounts sont partagés — on injecte tous les noms de banques dans chaque
  // société pour couvrir le cas où le libellé côté banque évoque un compte.
  const bankNames = (bankAccounts || [])
    .map(b => (b as any).name)
    .filter((s: unknown): s is string => typeof s === 'string' && s.length >= 3);

  return (companies || []).map(c => {
    const row = c as { id: string; name: string };
    return {
      company_id: row.id,
      aliases: [row.name, ...bankNames].filter(Boolean),
    };
  });
}

async function loadTransactions(
  client: ReturnType<typeof createClient>,
  from: string,
  to: string,
): Promise<IntercompanyTx[]> {
  const all: IntercompanyTx[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from('transactions')
      .select('id, company_id, date, amount, type, description')
      .is('deleted_at', null)
      .gte('date', from)
      .lte('date', to)
      .gte('amount', 500)
      .order('date', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as any[];
    for (const r of rows) {
      if (r.type !== 'income' && r.type !== 'expense') continue;
      all.push({
        id: r.id,
        company_id: r.company_id,
        date: r.date,
        amount: Number(r.amount),
        type: r.type,
        description: r.description,
      });
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function loadExistingLinks(client: ReturnType<typeof createClient>): Promise<ExistingLink[]> {
  const { data, error } = await client
    .from('intercompany_links' as any)
    .select('tx_out_id, tx_in_id, company_out, company_in, status');
  if (error) throw error;
  return ((data as any[]) || []) as ExistingLink[];
}

async function persistDecisions(
  client: ReturnType<typeof createClient>,
  decisions: IntercompanyMatchDecision[],
): Promise<{ inserted: number; skipped: number; insertedIds: string[] }> {
  if (decisions.length === 0) return { inserted: 0, skipped: 0, insertedIds: [] };
  const rows = decisions.map(d => ({
    tx_out_id: d.tx_out_id,
    tx_in_id: d.tx_in_id,
    company_out: d.company_out,
    company_in: d.company_in,
    amount: d.amount,
    score: d.score,
    score_breakdown: d.score_breakdown,
    status: d.status,
  }));

  // Insert one-by-one via upsert-ignore to survive UNIQUE conflicts silently
  // (peut arriver quand deux passes se croisent).
  let inserted = 0;
  let skipped = 0;
  const insertedIds: string[] = [];
  for (const row of rows) {
    const { data, error } = await client
      .from('intercompany_links' as any)
      .insert(row)
      .select('id, status')
      .single();
    if (error) {
      if ((error as any).code === '23505') {
        skipped++;
      } else {
        throw error;
      }
    } else {
      inserted++;
      const rec = data as { id: string; status: string };
      if (rec?.status === 'auto_matched') insertedIds.push(rec.id);
    }
  }
  return { inserted, skipped, insertedIds };
}

async function runMatching(
  client: ReturnType<typeof createClient>,
  from: string,
  to: string,
  aliases: CompanyAlias[],
  existing: ExistingLink[],
  minAmount: number,
): Promise<{ scanned: number; decisions: IntercompanyMatchDecision[] }> {
  const txs = await loadTransactions(client, from, to);
  const decisions = matchIntercompanyTransfers({
    transactions: txs,
    aliases,
    existingLinks: existing,
    minAmount,
  });
  return { scanned: txs.length, decisions };
}

async function logRun(
  client: ReturnType<typeof createClient>,
  mode: 'backfill' | 'incremental',
  triggeredBy: string,
  summary: RunSummary,
  error?: string,
): Promise<void> {
  try {
    await client.from('intercompany_match_runs' as any).insert({
      mode,
      triggered_by: triggeredBy,
      status: error ? 'failed' : 'success',
      candidates_scanned: summary.candidates_scanned,
      auto_matched: summary.auto_matched,
      suggested: summary.suggested,
      inserted: summary.inserted,
      skipped_existing: summary.skipped_existing,
      windows_processed: summary.windows_processed,
      error_message: error ?? null,
      details: summary as any,
    } as any);
  } catch (e) {
    console.error('[match-intercompany] failed to log run:', e);
  }
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

  const body: RequestBody & { triggered_by?: string } =
    req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const mode: 'backfill' | 'incremental' = body.mode ?? 'incremental';
  const triggeredBy = body.triggered_by ?? 'manual';
  const minAmount = body.min_amount ?? 500;


  const summary: RunSummary = {
    windows_processed: 0,
    candidates_scanned: 0,
    auto_matched: 0,
    suggested: 0,
    inserted: 0,
    skipped_existing: 0,
    errors: [],
  };

  try {
    const aliases = await loadAliases(client);

    // Fenêtres
    let windows: Array<{ from: string; to: string }>;
    if (mode === 'backfill') {
      // Trouver la date min
      const { data: minRow, error: minErr } = await client
        .from('transactions')
        .select('date')
        .is('deleted_at', null)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (minErr) throw minErr;
      const start = body.from ?? (minRow as any)?.date ?? isoDay(new Date());
      const end = isoDay(new Date());
      windows = monthWindows(start, end);
    } else {
      const sinceDays = body.since_days ?? 10;
      const end = new Date();
      const start = new Date(end.getTime() - sinceDays * 86_400_000);
      windows = [{ from: isoDay(start), to: isoDay(end) }];
    }

    for (const w of windows) {
      // Recharger les existingLinks à chaque fenêtre (une passe peut créer des liens
      // qui influencent la détection récurrente de la fenêtre suivante).
      const existing = await loadExistingLinks(client);
      const { scanned, decisions } = await runMatching(
        client,
        w.from,
        w.to,
        aliases,
        existing,
        minAmount,
      );
      const { inserted, skipped } = await persistDecisions(client, decisions);
      summary.windows_processed++;
      summary.candidates_scanned += scanned;
      summary.auto_matched += decisions.filter(d => d.status === 'auto_matched').length;
      summary.suggested += decisions.filter(d => d.status === 'suggested').length;
      summary.inserted += inserted;
      summary.skipped_existing += skipped;
    }

    await logRun(client, mode, triggeredBy, summary);
    return new Response(JSON.stringify({ ok: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[match-intercompany] error:', err);
    summary.errors.push(msg);
    await logRun(client, mode, triggeredBy, summary, msg);
    return new Response(JSON.stringify({ ok: false, error: msg, summary }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
