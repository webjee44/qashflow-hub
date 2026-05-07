import { ShieldCheck, ShieldAlert, ShieldX, Loader2, AlertTriangle, Info, Lock, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AutomationPreview, MerchantSuggestion } from '../api/automationPreviewApi';
import { SCORE_REASON_LABELS } from '../lib/ruleScoring';

interface AutomationPreviewPanelProps {
  preview: AutomationPreview | null;
  loading: boolean;
  error: string | null;
  className?: string;
  onLockToMerchant?: (suggestion: MerchantSuggestion) => void;
}

const WARNING_LABELS: Record<string, string> = {
  pattern_too_short: 'Mot-clé trop court (risque de faux positifs)',
  high_match_volume: 'Volume de transactions impactées élevé',
  historical_category_conflict: 'Des transactions similaires sont déjà classées ailleurs',
  type_mismatch: 'Certaines transactions ont un type incompatible avec la catégorie',
  overlapping_rules: 'D\'autres règles actives matchent les mêmes transactions',
  high_amount: 'Montant total impacté élevé',
};

function safetyVisual(score: number) {
  if (score >= 0.8) {
    return { Icon: ShieldCheck, label: 'Sécurité forte', tone: 'text-success bg-success/10 border-success/30' };
  }
  if (score >= 0.6) {
    return { Icon: ShieldAlert, label: 'Vigilance', tone: 'text-amber-600 bg-amber-500/10 border-amber-500/30' };
  }
  return { Icon: ShieldX, label: 'Risque', tone: 'text-destructive bg-destructive/10 border-destructive/30' };
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AutomationPreviewPanel({
  preview,
  loading,
  error,
  className,
  onLockToMerchant,
}: AutomationPreviewPanelProps) {
  if (error) {
    return (
      <div className={cn('rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive', className)}>
        Impossible de calculer l'impact: {error}
      </div>
    );
  }

  if (loading || !preview) {
    return (
      <div className={cn('rounded-lg border border-border/50 bg-muted/30 p-4 flex items-center gap-3 text-sm text-muted-foreground', className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Calcul de l'impact serveur en cours...
      </div>
    );
  }

  const { Icon, label, tone } = safetyVisual(preview.safety_score);
  const scorePct = Math.round(preview.safety_score * 100);

  return (
    <div className={cn('rounded-lg border border-border/60 bg-background p-4 space-y-4', className)}>
      {/* Safety score header */}
      <div className={cn('flex items-center justify-between gap-3 rounded-md border px-3 py-2', tone)}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-semibold">{scorePct}%</span>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Transactions concernées" value={preview.matched_total} />
        <Stat label="À catégoriser maintenant" value={preview.matched_uncategorized} highlight />
        <Stat label="Déjà dans la cible" value={preview.same_category_count} />
        <Stat
          label="Déjà classées ailleurs"
          value={preview.other_category_count}
          warning={preview.other_category_count > 0}
        />
      </div>

      {/* Amount impact */}
      <div className="text-xs text-muted-foreground">
        Montant total impacté (transactions à catégoriser):{' '}
        <span className="font-medium text-foreground">{formatAmount(preview.total_amount_impact)}</span>
      </div>

      {/* Conflicts */}
      {preview.conflicts_with_other_rules.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            Règles en conflit
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {preview.conflicts_with_other_rules.slice(0, 5).map((c) => (
              <li key={c.rule_id}>
                • {c.rule_name} — {c.overlap_count} transaction{c.overlap_count > 1 ? 's' : ''} en chevauchement
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="space-y-1">
          {preview.warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{WARNING_LABELS[w] || w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Examples */}
      {preview.examples.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Exemples</div>
          <div className="space-y-1">
            {preview.examples.slice(0, 5).map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1.5"
              >
                <span className="truncate flex-1 mr-2">{ex.description}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase tracking-wide',
                    ex.status === 'will_apply' && 'border-primary/40 text-primary',
                    ex.status === 'already_target' && 'border-success/40 text-success',
                    ex.status === 'already_other' && 'border-amber-500/40 text-amber-700',
                    ex.status === 'type_mismatch' && 'border-destructive/40 text-destructive',
                  )}
                >
                  {labelForStatus(ex.status)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function labelForStatus(s: string) {
  switch (s) {
    case 'will_apply': return 'À appliquer';
    case 'already_target': return 'Déjà cible';
    case 'already_other': return 'Conflit';
    case 'type_mismatch': return 'Type ≠';
    default: return s;
  }
}

function Stat({
  label,
  value,
  highlight,
  warning,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        highlight && 'border-primary/30 bg-primary/5',
        warning && 'border-amber-500/30 bg-amber-500/5',
        !highlight && !warning && 'border-border/50 bg-muted/20',
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
