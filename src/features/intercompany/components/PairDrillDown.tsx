import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { formatEUR, formatDateFR } from '../lib/format';
import { ScoreBadge } from './ScoreBadge';
import type { IntercompanyLinkRow } from '../api/intercompanyApi';
import { useDecideLink } from '../hooks/useIntercompanyData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pair: { a: string; b: string } | null;
  links: IntercompanyLinkRow[];
  companyName: (id: string) => string;
}

const statusMeta: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  auto_matched: { label: 'Auto', variant: 'default' },
  confirmed: { label: 'Confirmé', variant: 'default' },
  suggested: { label: 'Suggéré', variant: 'secondary' },
  rejected: { label: 'Rejeté', variant: 'destructive' },
};

export function PairDrillDown({ open, onOpenChange, pair, links, companyName }: Props) {
  const decide = useDecideLink();

  const pairLinks = pair
    ? links
        .filter(
          l =>
            (l.company_out === pair.a && l.company_in === pair.b) ||
            (l.company_out === pair.b && l.company_in === pair.a),
        )
        .sort((x, y) => (y.tx_date > x.tx_date ? 1 : -1))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pair
              ? `Flux ${companyName(pair.a)} ↔ ${companyName(pair.b)}`
              : 'Flux intergroupe'}
          </DialogTitle>
        </DialogHeader>

        {pairLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucun lien pour cette paire.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Sens</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Libellé sortie</TableHead>
                <TableHead>Libellé entrée</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairLinks.map(l => {
                const meta = statusMeta[l.status] ?? { label: l.status, variant: 'outline' as const };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{formatDateFR(l.tx_date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {companyName(l.company_out)} → {companyName(l.company_in)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatEUR(l.amount)}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs" title={l.tx_out?.description ?? ''}>
                      {l.tx_out?.description ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs" title={l.tx_in?.description ?? ''}>
                      {l.tx_in?.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={l.score} breakdown={l.score_breakdown} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {l.status === 'suggested' ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ id: l.id, status: 'confirmed' })}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ id: l.id, status: 'rejected' })}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
