import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { formatEUR, formatDateFR } from '../lib/format';
import { ScoreBadge } from './ScoreBadge';
import type { IntercompanyLinkRow } from '../api/intercompanyApi';
import { useDecideLink } from '../hooks/useIntercompanyData';

interface Props {
  links: IntercompanyLinkRow[];
  companyName: (id: string) => string;
}

export function SuggestionsQueue({ links, companyName }: Props) {
  const decide = useDecideLink();
  const suggested = links
    .filter(l => l.status === 'suggested')
    .sort((a, b) => b.amount - a.amount);

  if (suggested.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucune suggestion en attente de validation.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Émetteur</TableHead>
            <TableHead>Bénéficiaire</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Libellé sortie</TableHead>
            <TableHead>Libellé entrée</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suggested.map(l => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap">{formatDateFR(l.matched_at)}</TableCell>
              <TableCell className="font-medium">{companyName(l.company_out)}</TableCell>
              <TableCell className="font-medium">{companyName(l.company_in)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                {formatEUR(l.amount)}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={l.tx_out?.description ?? ''}>
                {l.tx_out?.description ?? '—'}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={l.tx_in?.description ?? ''}>
                {l.tx_in?.description ?? '—'}
              </TableCell>
              <TableCell>
                <ScoreBadge score={l.score} breakdown={l.score_breakdown} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: l.id, status: 'confirmed' })}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Confirmer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: l.id, status: 'rejected' })}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Rejeter
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
