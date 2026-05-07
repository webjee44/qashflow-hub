import { supabase } from '@/integrations/supabase/client';

export interface AutomationRunSummary {
  id: string;
  rule_id: string | null;
  triggered_by: string;
  mode: string;
  total_matched: number;
  total_applied: number;
  total_skipped_conflict: number;
  status: string;
  can_rollback: boolean;
  started_at: string;
  finished_at: string | null;
  rolled_back_at: string | null;
}

export async function listRunsForRule(ruleId: string, limit = 20): Promise<AutomationRunSummary[]> {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('id, rule_id, triggered_by, mode, total_matched, total_applied, total_skipped_conflict, status, can_rollback, started_at, finished_at, rolled_back_at')
    .eq('rule_id', ruleId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AutomationRunSummary[];
}

export async function rollbackRun(runId: string): Promise<{ run_id: string; reverted: number }> {
  const { data, error } = await supabase.functions.invoke('rollback-automation-run', {
    body: { run_id: runId },
  });
  if (error) throw error;
  return data;
}
