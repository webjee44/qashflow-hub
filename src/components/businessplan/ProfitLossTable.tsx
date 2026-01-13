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

  const displayMonths = data.months.slice(0, 12);
  const totalRevenue = data.annualSummary.revenue;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[250px]">Libellé</TableHead>
            {displayMonths.map((month, i) => (
              <TableHead key={i} className="text-center min-w-[90px]">
                {format(month, 'MMM yy', { locale: fr })}
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[110px] bg-muted/50">Année 1</TableHead>
            <TableHead className="text-center min-w-[70px] bg-muted/50">%CA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row, rowIndex) => {
            const annualValue = row.values.slice(0, 12).reduce((a, b) => a + b, 0);
            const percentOfRevenue = totalRevenue > 0 && row.type !== 'header' 
              ? (annualValue / totalRevenue) * 100 
              : null;

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
                {displayMonths.map((_, monthIndex) => {
                  const value = row.values[monthIndex] || 0;
                  return (
                    <TableCell 
                      key={monthIndex} 
                      className={cn(
                        "text-center text-sm",
                        getValueClasses(row, value)
                      )}
                    >
                      {row.type === 'header' ? '' : (value !== 0 ? formatCurrency(value) : '-')}
                    </TableCell>
                  );
                })}
                <TableCell className={cn(
                  "text-center font-semibold",
                  row.type === 'total' ? "bg-primary/20" : 
                  row.type === 'sig' ? "bg-primary/10" : "bg-muted/50",
                  getValueClasses(row, annualValue)
                )}>
                  {row.type === 'header' ? '' : formatCurrency(annualValue)}
                </TableCell>
                <TableCell className={cn(
                  "text-center text-xs",
                  row.type === 'total' ? "bg-primary/20" : 
                  row.type === 'sig' ? "bg-primary/10" : "bg-muted/50",
                  row.isExpense && percentOfRevenue && percentOfRevenue !== 0 ? "text-destructive" : "",
                  !row.isExpense && percentOfRevenue && percentOfRevenue > 0 ? "text-success" : ""
                )}>
                  {row.type === 'header' || percentOfRevenue === null ? '' : 
                    `${percentOfRevenue >= 0 ? '' : ''}${percentOfRevenue.toFixed(1)}%`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
