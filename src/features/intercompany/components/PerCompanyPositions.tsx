import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatEUR } from '../lib/format';
import type { CompanyPosition } from '../engine/computeIntercompanyPositions';

interface Props {
  perCompany: CompanyPosition[];
  companyName: (id: string) => string;
  periodLabel: string;
  onSelectPair: (pair: { a: string; b: string }) => void;
}

/**
 * Vue par société : pour chacune, position nette vis-à-vis du groupe
 * + détail par contrepartie repliable.
 */
export function PerCompanyPositions({ perCompany, companyName, periodLabel, onSelectPair }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (perCompany.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucune société n'a de position intergroupe.
      </div>
    );
  }

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {perCompany.map(c => {
        const isOpen = expanded.has(c.company_id);
        const netClass =
          c.net > 0 ? 'text-emerald-600' : c.net < 0 ? 'text-destructive' : 'text-muted-foreground';
        const NetIcon = c.net > 0 ? TrendingUp : c.net < 0 ? TrendingDown : Minus;
        const netLabel =
          c.net > 0
            ? `Créancier net du groupe`
            : c.net < 0
              ? `Débiteur net du groupe`
              : 'Équilibré';

        return (
          <Card key={c.company_id}>
            <CardContent className="p-0">
              <button
                type="button"
                onClick={() => toggle(c.company_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{companyName(c.company_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      Créances {formatEUR(c.total_receivable)} · Dettes {formatEUR(c.total_debt)}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 shrink-0 ${netClass}`}>
                  <NetIcon className="h-4 w-4" />
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {c.net === 0 ? '—' : formatEUR(Math.abs(c.net))}
                    </p>
                    <p className="text-xs">{netLabel}</p>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t bg-muted/20">
                  {c.counterparties.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-4">Aucune contrepartie.</p>
                  ) : (
                    <ul className="divide-y">
                      {c.counterparties.map(cp => {
                        const pair =
                          c.company_id < cp.counterparty
                            ? { a: c.company_id, b: cp.counterparty }
                            : { a: cp.counterparty, b: c.company_id };
                        const isCreditor = cp.balance > 0;
                        const isDebtor = cp.balance < 0;
                        const balanceClass = isCreditor
                          ? 'text-emerald-600'
                          : isDebtor
                            ? 'text-destructive'
                            : 'text-muted-foreground';
                        const phrase = isCreditor
                          ? `${companyName(cp.counterparty)} lui doit`
                          : isDebtor
                            ? `Doit à ${companyName(cp.counterparty)}`
                            : `Équilibré avec ${companyName(cp.counterparty)}`;
                        return (
                          <li key={cp.counterparty}>
                            <button
                              type="button"
                              onClick={() => onSelectPair(pair)}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 text-left"
                            >
                              <div className="min-w-0">
                                <p className="text-sm truncate">{phrase}</p>
                                <p className="text-xs text-muted-foreground">
                                  {cp.movements_total} mouvement{cp.movements_total > 1 ? 's' : ''} total
                                  {cp.movements_period !== cp.movements_total && (
                                    <> · {cp.movements_period} sur {periodLabel}</>
                                  )}
                                </p>
                              </div>
                              <div className={`text-right shrink-0 ${balanceClass}`}>
                                <p className="font-semibold tabular-nums">
                                  {cp.balance === 0 ? (
                                    <Badge variant="secondary">équilibré</Badge>
                                  ) : (
                                    formatEUR(Math.abs(cp.balance))
                                  )}
                                </p>
                                {cp.variation_period !== 0 && (
                                  <p className="text-xs">
                                    {cp.variation_period > 0 ? '+' : '−'}
                                    {formatEUR(Math.abs(cp.variation_period)).replace('−', '')} sur {periodLabel}
                                  </p>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
