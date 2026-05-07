import { useEffect, useState } from 'react';
import { History, RotateCcw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { listRunsForRule, rollbackRun, type AutomationRunSummary } from '../api/automationRunsApi';

interface Props {
  ruleId: string;
  onRolledBack?: () => void;
}

/**
 * PR2 — Run history & rollback UI for a single rule.
 *
 * Shows the last 20 runs with totals, status, and a one-click rollback
 * action when allowed. Rollback restores `previous_category_id` for every
 * applied transaction in the run.
 */
export function AutomationRunHistory({ ruleId, onRolledBack }: Props) {
  const [runs, setRuns] = useState<AutomationRunSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listRunsForRule(ruleId);
      setRuns(data);
    } catch (e) {
      console.error('[AutomationRunHistory] load failed', e);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [ruleId]);

  const handleRollback = async (runId: string) => {
    if (!confirm('Annuler ce run restaurera les anciennes catégories des transactions concernées. Continuer ?')) return;
    setRollingBack(runId);
    try {
      const res = await rollbackRun(runId);
      toast.success(`${res.reverted} transaction${res.reverted > 1 ? 's' : ''} restaurée${res.reverted > 1 ? 's' : ''}`);
      await refresh();
      onRolledBack?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Échec de l\'annulation');
    } finally {
      setRollingBack(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement de l'historique…
      </div>
    );
  }
  if (!runs || runs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground p-3 border border-dashed border-border rounded-md">
        Aucun run enregistré pour cette règle.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="w-4 h-4 text-muted-foreground" />
        Historique des exécutions
      </div>
      <div className="space-y-2">
        {runs.map((r) => {
          const date = new Date(r.started_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
          const isRolled = r.status === 'rolled_back';
          return (
            <div key={r.id} className="border border-border/60 rounded-md p-3 text-sm flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">{date}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{r.triggered_by}</Badge>
                  {isRolled && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700">
                      annulé
                    </Badge>
                  )}
                  {r.total_skipped_conflict > 0 && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {r.total_skipped_conflict} conflit{r.total_skipped_conflict > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  {r.total_applied} appliquée{r.total_applied > 1 ? 's' : ''} sur {r.total_matched} match{r.total_matched > 1 ? 'es' : ''}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={!r.can_rollback || isRolled || rollingBack === r.id || r.total_applied === 0}
                onClick={() => handleRollback(r.id)}
                className="shrink-0"
              >
                {rollingBack === r.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                )}
                Annuler
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
