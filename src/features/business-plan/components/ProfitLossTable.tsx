import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProfitLoss, PLRow } from '@/hooks/useProfitLoss';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function ProfitLossTable() {
  const { data, isLoading } = useProfitLoss();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRowClasses = (row: PLRow) => {
    switch (row.type) {
      case 'header':
        return 'bg-muted/50 font-bold text-foreground';
      case 'subtotal':
        return 'font-semibold border-t bg-muted/20';
      case 'sig':
        return 'bg-primary/5 font-bold text-primary border-y';
      case 'total':
        return 'bg-primary/10 font-bold text-lg border-y-2';
      default:
        return '';
    }
  };

  const getValueClasses = (row: PLRow, value: number) => {
    if (row.type === 'total' || row.type === 'sig') {
      return value >= 0 ? 'text-success' : 'text-destructive';
    }
    if (row.isExpense && value !== 0) {
      return 'text-destructive';
    }
    if ((row.type === 'item' || row.type === 'subtotal') && !row.isExpense) {
      return value > 0 ? 'text-success' : '';
    }
    return '';
  };

  const getIndentClass = (indent?: number) => {
    if (!indent) return '';
    if (indent === 1) return 'pl-4';
    if (indent === 2) return 'pl-8';
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Format year label with dates
  const formatYearLabel = (year: typeof data.years[0], index: number) => {
    const startStr = format(year.start, 'MMM yyyy', { locale: fr });
    const endStr = format(year.end, 'MMM yyyy', { locale: fr });
    return `Année ${index + 1}\n(${startStr} - ${endStr})`;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[280px]">Libellé</TableHead>
            {data.years.map((year, i) => (
              <TableHead key={i} className="text-center min-w-[140px]">
                <div className="flex flex-col">
                  <span className="font-semibold">Année {i + 1}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(year.start, 'MMM yy', { locale: fr })} - {format(year.end, 'MMM yy', { locale: fr })}
                  </span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row, rowIndex) => {
            return (
              <TableRow key={rowIndex} className={getRowClasses(row)}>
                <TableCell className={cn(
                  "sticky left-0 z-10",
                  row.type === 'header' && "bg-muted/50",
                  row.type === 'subtotal' && "bg-muted/20",
                  row.type === 'sig' && "bg-primary/5",
                  row.type === 'total' && "bg-primary/10",
                  row.type === 'item' && "bg-background",
                  getIndentClass(row.indent)
                )}>
                  {row.label}
                </TableCell>
                {data.years.map((_, yearIndex) => {
                  const value = row.values[yearIndex] || 0;
                  return (
                    <TableCell 
                      key={yearIndex} 
                      className={cn(
                        "text-center",
                        getValueClasses(row, value)
                      )}
                    >
                      {row.type === 'header' ? '' : (value !== 0 ? formatCurrency(value) : '-')}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}