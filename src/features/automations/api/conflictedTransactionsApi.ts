/**
 * Read the current queue of transactions blocked by rule conflicts.
 *
 * A transaction is "in conflict" when its LAST automation_run_item is
 * status='skipped_conflict' AND evidence->>'decision' = 'conflict' AND the
 * transaction is still uncategorized. That guarantees we only surface rows
 * where the user still has a decision to take (real conflict, not a legacy
 * skip that was later resolved manually or by another rule).
 *
 * The `evidence.competing_rules` array carries the IDs of the 2-3 rules that
 * matched — the UI lists them so the user can pick a target or bump priority.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ConflictedTransactionInfo {
  transactionId: string;
  runItemId: string;
  competingRuleIds: string[];
  detectedAt: string;
}

export async function fetchConflictedTransactions(
  companyId: string,
): Promise<Map<string, ConflictedTransactionInfo>> {
  // 1. Get the recent run IDs for this company. We bound the window to the
  //    last 30 days so a very old resolved conflict does not resurface after
  //    the user manually categorised the transaction.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: runs, error: runsErr } = await supabase
    .from('automation_runs')
    .select('id')
    .eq('company_id', companyId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);
  if (runsErr) throw runsErr;
  const runIds = (runs || []).map((r) => r.id);
  if (runIds.length === 0) return new Map();

  // 2. Pull skipped_conflict items for these runs, newest first.
  const { data: items, error: itemsErr } = await supabase
    .from('automation_run_items')
    .select('id, transaction_id, evidence, created_at, status')
    .in('run_id', runIds)
    .eq('status', 'skipped_conflict')
    .order('created_at', { ascending: false });
  if (itemsErr) throw itemsErr;

  // Keep only the MOST RECENT item per transaction.
  const latestByTx = new Map<string, ConflictedTransactionInfo>();
  for (const it of items || []) {
    if (latestByTx.has(it.transaction_id)) continue;
    const ev = (it.evidence ?? {}) as Record<string, unknown>;
    if (ev.decision !== 'conflict') continue;
    const competing = Array.isArray(ev.competing_rules)
      ? (ev.competing_rules as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    latestByTx.set(it.transaction_id, {
      transactionId: it.transaction_id,
      runItemId: it.id,
      competingRuleIds: competing,
      detectedAt: it.created_at,
    });
  }
  if (latestByTx.size === 0) return latestByTx;

  // 3. Filter out transactions that have since been categorised or deleted.
  const txIds = Array.from(latestByTx.keys());
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('id, category_id, deleted_at')
    .in('id', txIds);
  if (txErr) throw txErr;
  const stillOpen = new Set(
    (txs || [])
      .filter((t) => t.category_id === null && t.deleted_at === null)
      .map((t) => t.id),
  );
  for (const id of Array.from(latestByTx.keys())) {
    if (!stillOpen.has(id)) latestByTx.delete(id);
  }
  return latestByTx;
}

/**
 * Bump a rule's priority so it wins future ties against `competitors`.
 * Sets priority = max(competitors) + 10 to leave headroom for future edits.
 */
export async function bumpRulePriorityAbove(
  ruleId: string,
  competitorIds: string[],
): Promise<number> {
  let maxCompetitor = 100;
  if (competitorIds.length > 0) {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('priority')
      .in('id', competitorIds);
    if (error) throw error;
    for (const r of data || []) {
      const p = Number(r.priority ?? 100);
      if (p > maxCompetitor) maxCompetitor = p;
    }
  }
  const nextPriority = maxCompetitor + 10;
  const { error } = await supabase
    .from('automation_rules')
    .update({ priority: nextPriority })
    .eq('id', ruleId);
  if (error) throw error;
  return nextPriority;
}
