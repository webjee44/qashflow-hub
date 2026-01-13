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
        return 'font-semibold border-t';
      case 'total':
        return 'bg-primary/10 font-bold text-lg';
      default:
        return '';
    }
  };

  const getValueClasses = (row: PLRow, value: number) => {
    if (row.type === 'total') {
      return value >= 0 ? 'text-success' : 'text-destructive';
    }
    if (row.isExpense) {
      return 'text-destructive';
    }
    if (row.type === 'item' || row.type === 'subtotal') {
      return value > 0 ? 'text-success' : '';
    }
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

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Libellé</TableHead>
            {displayMonths.map((month, i) => (
              <TableHead key={i} className="text-center min-w-[90px]">
                {format(month, 'MMM yy', { locale: fr })}
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[120px] bg-muted/50">Année 1</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex} className={getRowClasses(row)}>
              <TableCell className={cn(
                "sticky left-0 z-10",
                row.type === 'header' && "bg-muted/50",
                row.type === 'total' && "bg-primary/10",
                row.type !== 'header' && row.type !== 'total' && "bg-background"
              )}>
                {row.type === 'item' && <span className="ml-4">{row.label}</span>}
                {row.type !== 'item' && row.label}
              </TableCell>
              {displayMonths.map((_, monthIndex) => {
                const value = row.values[monthIndex] || 0;
                return (
                  <TableCell 
                    key={monthIndex} 
                    className={cn(
                      "text-center",
                      getValueClasses(row, value)
                    )}
                  >
                    {row.type === 'header' ? '' : (value !== 0 ? formatCurrency(value) : '-')}
                  </TableCell>
                );
              })}
              <TableCell className={cn(
                "text-center font-semibold",
                row.type === 'total' ? "bg-primary/20" : "bg-muted/50",
                getValueClasses(row, row.values.slice(0, 12).reduce((a, b) => a + b, 0))
              )}>
                {row.type === 'header' ? '' : formatCurrency(row.values.slice(0, 12).reduce((a, b) => a + b, 0))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
