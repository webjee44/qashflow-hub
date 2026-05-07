import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * PR3 — Real, honest stats computed from `automation_runs` + `automation_run_items`.
 *
 * Replaces the previous hardcoded `{ accuracy: 96, timeSaved: '12h' }` lie.
 *
 * Definitions:
 *  - `total_applied`            : items with status='applied' or 'corrected'
 *  - `total_corrected`          : items with status='corrected' (user changed cat after)
 *  - `total_rolled_back`        : items with status='rolled_back'
 *  - `stability_rate_30d`       : (applied 30d - corrected 30d - rolled_back 30d) / applied 30d
 *  - `correction_rate`          : corrected / applied (lifetime)
 *  - `conflict_rate`            : runs with skipped_conflict>0 / total runs (lifetime)
 *  - `time_saved_estimate_hours`: applied * 8 seconds, formatted to hours
 *
 * Returns NULL for rates when sample size is zero (we never invent numbers).
 */
export interface AutomationRealStats {
  totalAutomated: number;
  stabilityRate30d: number | null;
  correctionRate: number | null;
  conflictRate: number | null;
  timeSavedHours: number;
  loading: boolean;
}

export function useAutomationRealStats(companyId: string | undefined): AutomationRealStats {
  const [state, setState] = useState<AutomationRealStats>({
    totalAutomated: 0,
    stabilityRate30d: null,
    correctionRate: null,
    conflictRate: null,
    timeSavedHours: 0,
    loading: true,
  });

  useEffect(() => {
    if (!companyId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let cancelled = false;
    (async () => {
      // Fetch lifetime items for this company's runs.
      const { data: runs } = await supabase
        .from('automation_runs')
        .select('id, total_skipped_conflict')
        .eq('company_id', companyId);
      const runIds = (runs ?? []).map(r => r.id);
      const totalRuns = runs?.length ?? 0;
      const conflictRuns = (runs ?? []).filter(r => (r.total_skipped_conflict ?? 0) > 0).length;

      let totalApplied = 0;
      let totalCorrected = 0;
      let totalRolledBack = 0;
      let appliedLast30d = 0;
      let correctedLast30d = 0;
      let rolledBackLast30d = 0;

      if (runIds.length > 0) {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: items } = await supabase
          .from('automation_run_items')
          .select('status, created_at, rolled_back_at, corrected_at')
          .in('run_id', runIds);
        for (const it of items ?? []) {
          const st = it.status as string;
          const isRecent = (it.created_at as string) >= since;
          if (st === 'applied') {
            totalApplied += 1;
            if (isRecent) appliedLast30d += 1;
          } else if (st === 'corrected') {
            totalApplied += 1; totalCorrected += 1;
            if (isRecent) { appliedLast30d += 1; correctedLast30d += 1; }
          } else if (st === 'rolled_back') {
            totalRolledBack += 1;
            if (isRecent) rolledBackLast30d += 1;
          }
        }
      }

      const stability = appliedLast30d > 0
        ? Math.max(0, (appliedLast30d - correctedLast30d - rolledBackLast30d) / appliedLast30d)
        : null;
      const correction = totalApplied > 0 ? totalCorrected / totalApplied : null;
      const conflict = totalRuns > 0 ? conflictRuns / totalRuns : null;
      const timeSavedHours = (totalApplied * 8) / 3600;

      if (!cancelled) {
        setState({
          totalAutomated: totalApplied,
          stabilityRate30d: stability,
          correctionRate: correction,
          conflictRate: conflict,
          timeSavedHours,
          loading: false,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  return state;
}
