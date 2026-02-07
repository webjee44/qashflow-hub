import { useBalanceSheet } from '@/hooks/useBalanceSheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

export function BalanceSheetTable() {
  const { data, isLoading } = useBalanceSheet();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const getRowClasses = (type: string) => {
    switch (type) {
      case 'header':
        return 'bg-muted/50 font-semibold text-sm uppercase tracking-wide';
      case 'subtotal':
        return 'bg-muted/30 font-semibold border-t';
      case 'total':
        return 'bg-primary/10 font-bold text-base border-t-2';
      default:
        return '';
    }
  };

  const getIndentClass = (indent?: number) => {
    if (!indent) return '';
    return `pl-${indent * 4}`;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Poste</TableHead>
          {data.years.map((year, i) => (
            <TableHead key={i} className="text-right">{year.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.map((row, rowIndex) => (
          <TableRow key={rowIndex} className={getRowClasses(row.type)}>
            <TableCell className={getIndentClass(row.indent)}>
              {row.label}
            </TableCell>
            {row.type === 'header' ? (
              data.years.map((_, i) => <TableCell key={i} />)
            ) : (
              row.values.map((value, i) => {
                const isNegativeAlert = row.alertNegative && value < 0;
                return (
                  <TableCell key={i} className="text-right">
                    <span className={isNegativeAlert ? 'text-destructive font-semibold inline-flex items-center gap-1 justify-end' : ''}>
                      {isNegativeAlert && <AlertTriangle className="h-4 w-4 shrink-0" />}
                      {formatCurrency(value)}
                    </span>
                  </TableCell>
                );
              })
            )}
          </TableRow>
        ))}
        
        {/* Separator */}
        <TableRow>
          <TableCell colSpan={data.years.length + 1} className="h-4 bg-background"></TableCell>
        </TableRow>

        {/* BFR Row */}
        <TableRow className="bg-accent/50 font-semibold">
          <TableCell>
            BFR (Stocks + Créances - Fournisseurs)
          </TableCell>
          {data.bfr.map((value, i) => (
            <TableCell key={i} className={`text-right ${value > 0 ? 'text-warning' : 'text-success'}`}>
              {formatCurrency(value)}
            </TableCell>
          ))}
        </TableRow>

        {/* Working Capital Row */}
        <TableRow className="bg-accent/50 font-semibold">
          <TableCell>
            Fonds de Roulement (Capitaux - Immos)
          </TableCell>
          {data.workingCapital.map((value, i) => (
            <TableCell key={i} className={`text-right ${value >= data.bfr[i] ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(value)}
            </TableCell>
          ))}
        </TableRow>

        {/* Cash position */}
        <TableRow className="bg-primary/20 font-bold">
          <TableCell>
            Trésorerie Nette (FR - BFR)
          </TableCell>
          {data.cash.map((netCash, i) => (
            <TableCell key={i} className={`text-right ${netCash >= 0 ? 'text-success' : 'text-destructive'}`}>
              <span className={netCash < 0 ? 'inline-flex items-center gap-1 justify-end' : ''}>
                {netCash < 0 && <AlertTriangle className="h-4 w-4 shrink-0" />}
                {formatCurrency(netCash)}
              </span>
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}
