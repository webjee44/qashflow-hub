import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { formatEUR } from '../lib/format';
import type { PairPosition } from '../engine/computeIntercompanyPositions';

interface Props {
  positions: PairPosition[];
  companyName: (id: string) => string;
  onSelect: (pair: { a: string; b: string }) => void;
  /** Libellé de la période affichée à côté de la colonne « Variation ». */
  periodLabel: string;
}

/**
 * Liste des positions comptes courants entre sociétés.
 * Convention : un virement A → B est une avance, le RECEVEUR (débiteur) doit à l'ÉMETTEUR (créancier).
 */
export function PositionsList({ positions, companyName, onSelect, periodLabel }: Props) {
  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucune position de compte courant entre sociétés.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead className="text-right">Solde (cumulé)</TableHead>
            <TableHead className="text-right">Variation {periodLabel}</TableHead>
            <TableHead className="text-right">Mouvements {periodLabel}</TableHead>
            <TableHead className="text-right">Total mvt.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map(p => {
            const key = `${p.company_a}|${p.company_b}`;
            const isBalanced = p.balance_abs === 0;
            const debtorName = p.debtor ? companyName(p.debtor) : null;
            const creditorName = p.creditor ? companyName(p.creditor) : null;
            const varClass =
              p.variation_period > 0
                ? 'text-emerald-600'
                : p.variation_period < 0
                  ? 'text-destructive'
                  : 'text-muted-foreground';
            const VarIcon =
              p.variation_period > 0
                ? TrendingUp
                : p.variation_period < 0
                  ? TrendingDown
                  : ArrowLeftRight;
            return (
              <TableRow
                key={key}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onSelect({ a: p.company_a, b: p.company_b })}
              >
                <TableCell className="font-medium text-sm">
                  {isBalanced ? (
                    <span className="text-muted-foreground">
                      {companyName(p.company_a)} ↔ {companyName(p.company_b)}
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold">{debtorName}</span>
                      <span className="text-muted-foreground"> doit à </span>
                      <span className="font-semibold">{creditorName}</span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {isBalanced ? (
                    <Badge variant="secondary">équilibré</Badge>
                  ) : (
                    formatEUR(p.balance_abs)
                  )}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${varClass}`}>
                  <span className="inline-flex items-center gap-1 justify-end">
                    <VarIcon className="h-3.5 w-3.5" />
                    {p.variation_period === 0
                      ? '—'
                      : (p.variation_period > 0 ? '+' : '−') +
                        formatEUR(Math.abs(p.variation_period)).replace('−', '')}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {p.movements_period}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {p.movements_total}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
