import { ShieldCheck, ShieldAlert, ShieldX, Loader2, AlertTriangle, Info, Target, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AutomationPreview, MerchantSuggestion } from '../api/automationPreviewApi';
import { SCORE_REASON_LABELS } from '../lib/ruleScoring';
import { prettifyMerchant } from '../lib/merchantLabel';

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
  overlapping_rules: "D'autres règles actives matchent les mêmes transactions",
  high_amount: 'Montant total impacté élevé',
};

function safetyVisual(score: number) {
  if (score >= 0.8) {
    return { Icon: ShieldCheck, label: 'Sûr', tone: 'text-success' };
  }
  if (score >= 0.6) {
    return { Icon: ShieldAlert, label: 'Vigilance', tone: 'text-amber-600' };
  }
  return { Icon: ShieldX, label: 'Risqué', tone: 'text-destructive' };
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
      <div className={cn('rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive', className)}>
        Impossible de calculer l'impact: {error}
      </div>
    );
  }

  if (loading || !preview) {
    return (
      <div className={cn('rounded-lg border border-border/50 bg-muted/30 p-3 flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Calcul en cours...
      </div>
    );
  }

  const { Icon, label, tone } = safetyVisual(preview.safety_score);
  const toApply = preview.matched_uncategorized;
  const hasDetails =
    preview.same_category_count > 0 ||
    preview.other_category_count > 0 ||
    preview.examples.length > 0 ||
    preview.warnings.length > 0 ||
    preview.conflicts_with_other_rules.length > 0 ||
    (preview.specificity_breakdown && preview.specificity_breakdown.contributions.length > 0);

  return (
    <div className={cn('rounded-lg border border-border/60 bg-background p-4 space-y-3', className)}>
      {/* Single-line summary: impact + safety */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm">
            <span className="font-semibold text-foreground tabular-nums">{toApply}</span>{' '}
            <span className="text-muted-foreground">
              transaction{toApply > 1 ? 's' : ''} {toApply > 1 ? 'seront catégorisées' : 'sera catégorisée'}
            </span>
          </div>
          {toApply > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {formatAmount(preview.total_amount_impact)}
            </div>
          )}
        </div>
        <div className={cn('flex items-center gap-1.5 text-xs font-medium shrink-0', tone)}>
          <Icon className="w-4 h-4" />
          {label}
        </div>
      </div>

      {/* Merchant suggestions stay visible — they're the main "smart" action */}
      {preview.merchant_suggestions && preview.merchant_suggestions.length > 0 && onLockToMerchant && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Target className="w-3 h-3" />
            Cibler un commerçant précis
          </div>
          {preview.merchant_suggestions.slice(0, 3).map((s) => (
            <button
              key={s.merchant_key}
              type="button"
              onClick={() => onLockToMerchant(s)}
              className="w-full flex items-center justify-between gap-2 text-left bg-muted/30 hover:bg-muted/60 rounded px-2.5 py-1.5 transition-colors"
            >
              <span className="text-xs font-medium truncate">{prettifyMerchant(s.merchant_key)}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {s.match_count}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Everything else collapsed */}
      {hasDetails && (
        <Collapsible>
          <CollapsibleTrigger className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group pt-1">
            <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]:rotate-180" />
            Voir les détails
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            {/* Counters */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Total concernées" value={preview.matched_total} />
              <Stat label="Déjà dans la cible" value={preview.same_category_count} />
              <Stat
                label="Déjà classées ailleurs"
                value={preview.other_category_count}
                warning={preview.other_category_count > 0}
              />
              <Stat label="À catégoriser" value={preview.matched_uncategorized} />
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
                      • {c.rule_name} — {c.overlap_count} en chevauchement
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
                      className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5"
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

            {/* Specificity breakdown — buried deepest */}
            {preview.specificity_breakdown && preview.specificity_breakdown.contributions.length > 0 && (
              <ul className="space-y-1 rounded-md border border-border/40 bg-muted/20 p-3">
                <li className="text-[11px] font-medium text-muted-foreground pb-1">
                  Score technique : {preview.specificity_breakdown.total >= 0 ? '+' : ''}
                  {preview.specificity_breakdown.total}
                </li>
                {preview.specificity_breakdown.contributions.map((c, i) => {
                  const positive = c.delta > 0;
                  return (
                    <li key={i} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                        {positive ? (
                          <TrendingUp className="w-3 h-3 text-success" />
                        ) : c.delta < 0 ? (
                          <TrendingDown className="w-3 h-3 text-destructive" />
                        ) : (
                          <Info className="w-3 h-3" />
                        )}
                        <span className="truncate">{SCORE_REASON_LABELS[c.reason]}</span>
                      </span>
                      <span
                        className={cn(
                          'font-mono tabular-nums shrink-0 ml-2',
                          positive && 'text-success',
                          c.delta < 0 && 'text-destructive',
                        )}
                      >
                        {positive ? '+' : ''}
                        {c.delta}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>
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
  warning,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        warning ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/40 bg-muted/20',
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
