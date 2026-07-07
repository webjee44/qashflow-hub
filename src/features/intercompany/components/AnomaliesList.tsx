import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { formatEUR, formatDateFR } from '../lib/format';
import type { AnomalyRow } from '../api/intercompanyApi';
import { useRunIncrementalMatch } from '../hooks/useIntercompanyData';

interface Props {
  anomalies: AnomalyRow[];
  companyName: (id: string) => string;
  companyNames: string[];
}

function looksExternal(desc: string | null, allCompanyNames: string[]): boolean {
  if (!desc) return true;
  const n = desc.toLowerCase();
  return !allCompanyNames.some(name => name.length >= 3 && n.includes(name.toLowerCase()));
}

export function AnomaliesList({ anomalies, companyName, companyNames }: Props) {
  const run = useRunIncrementalMatch();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {anomalies.length} transaction{anomalies.length > 1 ? 's' : ''} catégorisée{anomalies.length > 1 ? 's' : ''} interco / compte courant sans lien détecté.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={run.isPending}
          onClick={() => run.mutate(90)}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${run.isPending ? 'animate-spin' : ''}`} />
          Lancer un appariement
        </Button>
      </div>

      {anomalies.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune anomalie détectée.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Société</TableHead>
                <TableHead>Sens</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Indice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anomalies.map(a => {
                const external = looksExternal(a.description, companyNames);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{formatDateFR(a.date)}</TableCell>
                    <TableCell className="font-medium">{companyName(a.company_id)}</TableCell>
                    <TableCell>
                      <Badge variant={a.type === 'income' ? 'default' : 'secondary'}>
                        {a.type === 'income' ? 'Entrée' : 'Sortie'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatEUR(a.amount)}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground" title={a.description ?? ''}>
                      {a.description ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs">{a.category_name ?? '—'}</TableCell>
                    <TableCell>
                      {external ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Contrepartie externe probable
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Interne</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
