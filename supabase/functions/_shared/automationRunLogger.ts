/**
 * PR2 — Audit log helper for automation runs.
 *
 * Single source of truth for writing into `automation_runs` and `automation_run_items`
 * from any edge function that mutates transaction categories via rules.
 *
 * Design constraints:
 *  - Always create a run, even when 0 transactions are matched (auditability).
 *  - Snapshot `previous_category_id` BEFORE the bulk update so rollback is exact.
 *  - Items inserted in batches; failures don't break the run, they degrade `status`.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type RunMode = 'apply' | 'reclassify' | 'suggest_only';
export type TriggeredBy = 'manual' | 'cron' | 'user' | 'system';
export type ItemStatus =
  | 'applied'
  | 'skipped_conflict'
  | 'skipped_type_mismatch'
  | 'skipped_invalid_target'
  | 'rolled_back'
  | 'corrected';

export interface RunItemInput {
  rule_id: string | null;
  transaction_id: string;
  previous_category_id: string | null;
  new_category_id: string | null;
  confidence?: number | null;
  confidence_source?: string | null;
  reason_codes?: unknown[];
  evidence?: Record<string, unknown>;
  status?: ItemStatus;
}

export interface CreateRunInput {
  rule_id: string | null;
  company_id: string | null;
  user_id: string;
  triggered_by: TriggeredBy;
  mode: RunMode;
  metadata?: Record<string, unknown>;
}

export async function createRun(
  client: SupabaseClient,
  input: CreateRunInput,
): Promise<string> {
  const { data, error } = await client
    .from('automation_runs')
    .insert({
      rule_id: input.rule_id,
      company_id: input.company_id,
      user_id: input.user_id,
      triggered_by: input.triggered_by,
      mode: input.mode,
      status: 'running',
      can_rollback: input.mode !== 'suggest_only',
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function appendRunItems(
  client: SupabaseClient,
  runId: string,
  items: RunItemInput[],
): Promise<void> {
  if (items.length === 0) return;
  // Insert by chunks of 500 to stay under PostgREST limits.
  const chunkSize = 500;
  for (let i = 0; i < items.length; i += chunkSize) {
    const slice = items.slice(i, i + chunkSize).map((it) => ({
      run_id: runId,
      rule_id: it.rule_id,
      transaction_id: it.transaction_id,
      previous_category_id: it.previous_category_id,
      new_category_id: it.new_category_id,
      confidence: it.confidence ?? null,
      confidence_source: it.confidence_source ?? null,
      reason_codes: it.reason_codes ?? [],
      evidence: it.evidence ?? {},
      status: it.status ?? 'applied',
    }));
    const { error } = await client.from('automation_run_items').insert(slice);
    if (error) {
      // Don't throw — partial audit is better than no audit. Mark run failed.
      console.error('[automationRunLogger] appendRunItems failed:', error);
      await client
        .from('automation_runs')
        .update({ status: 'failed' })
        .eq('id', runId);
      return;
    }
  }
}

export async function finishRun(
  client: SupabaseClient,
  runId: string,
  totals: { matched: number; applied: number; skippedConflict: number },
  status: 'completed' | 'failed' = 'completed',
): Promise<void> {
  await client
    .from('automation_runs')
    .update({
      total_matched: totals.matched,
      total_applied: totals.applied,
      total_skipped_conflict: totals.skippedConflict,
      status,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId);
}
