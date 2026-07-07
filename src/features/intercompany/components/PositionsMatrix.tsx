import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatEUR } from '../lib/format';
import type { NetPosition } from '../engine/computeIntercompanyPositions';

interface Props {
  positions: NetPosition[];
  companyName: (id: string) => string;
  onSelect: (pair: { a: string; b: string }) => void;
}

export function PositionsMatrix({ positions, companyName, onSelect }: Props) {
  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucun flux intergroupe sur la période sélectionnée.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Émetteur (net)</TableHead>
            <TableHead>Bénéficiaire (net)</TableHead>
            <TableHead className="text-right">Position nette</TableHead>
            <TableHead className="text-right">Brut A→B</TableHead>
            <TableHead className="text-right">Brut B→A</TableHead>
            <TableHead className="text-right">Liens</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map(p => {
            const netIsAtoB = p.net_a_to_b >= 0;
            const emitter = netIsAtoB ? p.company_a : p.company_b;
            const receiver = netIsAtoB ? p.company_b : p.company_a;
            const netAbs = Math.abs(p.net_a_to_b);
            const key = `${p.company_a}|${p.company_b}`;
            return (
              <TableRow
                key={key}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onSelect({ a: p.company_a, b: p.company_b })}
              >
                <TableCell className="font-medium">{companyName(emitter)}</TableCell>
                <TableCell className="font-medium">{companyName(receiver)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {netAbs === 0 ? (
                    <Badge variant="secondary">équilibré</Badge>
                  ) : (
                    formatEUR(netAbs)
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatEUR(p.gross_a_to_b)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatEUR(p.gross_b_to_a)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {p.link_count}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
