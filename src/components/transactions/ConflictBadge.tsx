import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUp, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { useCategories } from '@/hooks/useCategories';
import { bumpRulePriorityAbove } from '@/features/automations/api/conflictedTransactionsApi';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

interface ConflictBadgeProps {
  competingRuleIds: string[];
}

/**
 * Surface a rule-conflict on a transaction row. Two decision paths:
 *  - manual categorisation (kept in the row's existing category picker)
 *  - bump the priority of one competing rule, which will make the same
 *    conflict resolve automatically at the next cron run for every row that
 *    matches the same pair. That is the "durably empty the queue" lever.
 */
export function ConflictBadge({ competingRuleIds }: ConflictBadgeProps) {
  const [open, setOpen] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const { rules, refetch: refetchRules } = useAutomationRules();
  const { categories } = useCategories();
  const queryClient = useQueryClient();

  const competing = useMemo(() => {
    const byId = new Map(rules.map((r) => [r.id, r] as const));
    return competingRuleIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => !!r);
  }, [rules, competingRuleIds]);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories],
  );

  if (competing.length === 0) return null;

  const handleBump = async (ruleId: string) => {
    setBusyRuleId(ruleId);
    try {
      const others = competingRuleIds.filter((id) => id !== ruleId);
      const next = await bumpRulePriorityAbove(ruleId, others);
      await refetchRules();
      await queryClient.invalidateQueries({ queryKey: ['conflicted-transactions'] });
      toast.success(`Règle priorisée (priorité ${next})`);
      setOpen(false);
    } catch (err) {
      logError('bumpRulePriorityAbove failed', err);
      toast.error('Impossible de modifier la priorité');
    } finally {
      setBusyRuleId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <Badge
            variant="outline"
            className="gap-1 border-warning/60 bg-warning/10 text-warning hover:bg-warning/20 cursor-pointer"
          >
            <AlertTriangle className="w-3 h-3" />
            Conflit de règles
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[360px] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Règles en compétition</p>
          <p className="text-xs text-muted-foreground mt-1">
            Aucune règle ne l'emporte à cause d'une priorité identique. Choisissez
            manuellement une catégorie, ou augmentez la priorité de la règle qui
            doit gagner.
          </p>
        </div>
        <div className="p-2 space-y-2 max-h-[280px] overflow-auto">
          {competing.map((rule) => {
            const cat = rule.target_category_id ? catById.get(rule.target_category_id) : null;
            return (
              <div
                key={rule.id}
                className="flex items-center gap-2 p-2 rounded-md border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate" title={rule.name}>
                    {rule.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cat && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      · priorité {(rule as any).priority ?? 100}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busyRuleId === rule.id}
                  onClick={() => handleBump(rule.id)}
                >
                  {busyRuleId === rule.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5" />
                  )}
                  Prioriser
                </Button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
