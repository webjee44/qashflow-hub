import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type IntercompanyStatus =
  | 'auto_matched'
  | 'confirmed'
  | 'suggested'
  | 'rejected';

export interface IntercompanyLinkRow {
  id: string;
  amount: number;
  status: IntercompanyStatus;
  score: number;
  score_breakdown: Json;
  matched_at: string;
  decided_at: string | null;
  decided_by: string | null;
  company_out: string;
  company_in: string;
  tx_out_id: string;
  tx_in_id: string;
  tx_out: {
    id: string;
    date: string;
    amount: number;
    description: string | null;
    company_id: string;
  } | null;
  tx_in: {
    id: string;
    date: string;
    amount: number;
    description: string | null;
    company_id: string;
  } | null;
}

export interface AnomalyRow {
  id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  description: string | null;
  company_id: string;
  category_id: string | null;
  category_name: string | null;
}

const LINK_SELECT = `
  id, amount, status, score, score_breakdown,
  matched_at, decided_at, decided_by,
  company_out, company_in, tx_out_id, tx_in_id,
  tx_out:tx_out_id (id, date, amount, description, company_id),
  tx_in:tx_in_id (id, date, amount, description, company_id)
`;

export async function fetchIntercompanyLinks(): Promise<IntercompanyLinkRow[]> {
  const { data, error } = await supabase
    .from('intercompany_links')
    .select(LINK_SELECT)
    .order('matched_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IntercompanyLinkRow[];
}

export async function decideLinkStatus(
  linkId: string,
  status: 'confirmed' | 'rejected',
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id ?? null;
  const { error } = await supabase
    .from('intercompany_links')
    .update({
      status,
      decided_at: new Date().toISOString(),
      decided_by: uid,
    })
    .eq('id', linkId);
  if (error) throw error;
}

/**
 * Anomalies : transactions catégorisées "intercompte / C-C" mais sans lien
 * intercompany. Détection par nom de catégorie (insensible casse).
 */
export async function fetchIntercompanyAnomalies(): Promise<AnomalyRow[]> {
  // 1. Categories dont le nom matche intercompte|intergroupe|c/c
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('id, name')
    .or(
      'name.ilike.%intercompte%,name.ilike.%intergroupe%,name.ilike.%inter-groupe%,name.ilike.%c/c%,name.ilike.%compte courant%',
    );
  if (catErr) throw catErr;
  const catIds = (cats ?? []).map(c => c.id);
  if (catIds.length === 0) return [];
  const catNameById = new Map((cats ?? []).map(c => [c.id, c.name] as const));

  // 2. Transactions liées à ces catégories, non ignorées
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('id, date, amount, type, description, company_id, category_id')
    .in('category_id', catIds)
    .is('deleted_at', null)
    .or('is_ignored.is.null,is_ignored.eq.false')
    .order('date', { ascending: false })
    .limit(500);
  if (txErr) throw txErr;
  if (!txs || txs.length === 0) return [];

  // 3. Exclure celles qui appartiennent à un lien intercompany actif
  const { data: linked, error: lErr } = await supabase
    .from('intercompany_links')
    .select('tx_out_id, tx_in_id, status')
    .neq('status', 'rejected');
  if (lErr) throw lErr;
  const linkedIds = new Set<string>();
  for (const l of linked ?? []) {
    linkedIds.add(l.tx_out_id);
    linkedIds.add(l.tx_in_id);
  }

  return txs
    .filter(t => !linkedIds.has(t.id))
    .map(t => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
      type: t.type as 'income' | 'expense',
      description: t.description,
      company_id: t.company_id,
      category_id: t.category_id,
      category_name: t.category_id ? catNameById.get(t.category_id) ?? null : null,
    }));
}

export async function triggerIncrementalMatch(sinceDays = 90): Promise<{
  status: string;
  summary?: unknown;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('match-intercompany', {
    body: { mode: 'incremental', since_days: sinceDays },
  });
  if (error) throw error;
  return data as { status: string; summary?: unknown; error?: string };
}
