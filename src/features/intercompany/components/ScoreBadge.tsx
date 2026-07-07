import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Json } from '@/integrations/supabase/types';

interface Props {
  score: number;
  breakdown: Json;
}

const LABELS: Record<string, string> = {
  base_opposite: 'Base (sens opposé)',
  same_day: 'Proximité date',
  alias_match: 'Alias société',
  recurring_pair: 'Paire récurrente',
  round_amount_penalty: 'Pénalité montant rond',
};

export function ScoreBadge({ score, breakdown }: Props) {
  const variant: 'default' | 'secondary' | 'destructive' =
    score >= 75 ? 'default' : score >= 50 ? 'secondary' : 'destructive';

  const entries =
    breakdown && typeof breakdown === 'object' && !Array.isArray(breakdown)
      ? Object.entries(breakdown as Record<string, unknown>)
      : [];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="tabular-nums cursor-help">{score}</Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1 text-xs">
          <div className="font-semibold mb-1">Décomposition du score</div>
          {entries.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{LABELS[k] ?? k}</span>
              <span className="tabular-nums font-medium">
                {typeof v === 'number' ? (v > 0 ? `+${v}` : String(v)) : String(v)}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
