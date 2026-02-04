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

  // Get row classes based on type and sectionType for PCG visual styling
  const getRowClasses = (row: PLRow) => {
    const baseClasses = [];
    
    // Section-based background colors
    if (row.sectionType === 'revenue') {
      if (row.type === 'header') {
        baseClasses.push('bg-emerald-100 dark:bg-emerald-900/40 font-bold text-emerald-900 dark:text-emerald-100');
      } else if (row.type === 'subtotal') {
        baseClasses.push('bg-emerald-50 dark:bg-emerald-900/20 font-semibold border-t');
      } else {
        baseClasses.push('bg-emerald-50/50 dark:bg-emerald-900/10');
      }
    } else if (row.sectionType === 'expense') {
      if (row.type === 'header') {
        baseClasses.push('bg-red-100 dark:bg-red-900/40 font-bold text-red-900 dark:text-red-100');
      } else if (row.type === 'subtotal') {
        baseClasses.push('bg-red-50 dark:bg-red-900/20 font-semibold border-t');
      } else {
        baseClasses.push('bg-red-50/50 dark:bg-red-900/10');
      }
    } else if (row.sectionType === 'result') {
      if (row.type === 'total') {
        baseClasses.push('bg-primary/20 font-bold text-lg border-y-2');
      } else {
        baseClasses.push('bg-primary/10 font-bold text-primary border-y');
      }
    } else {
      // Fallback for rows without sectionType
      switch (row.type) {
        case 'header':
          baseClasses.push('bg-muted/50 font-bold text-foreground');
          break;
        case 'subtotal':
          baseClasses.push('font-semibold border-t bg-muted/20');
          break;
        case 'sig':
          baseClasses.push('bg-primary/5 font-bold text-primary border-y');
          break;
        case 'total':
          baseClasses.push('bg-primary/10 font-bold text-lg border-y-2');
          break;
      }
    }
    
    return baseClasses.join(' ');
  };

  const getValueClasses = (row: PLRow, value: number) => {
    // For result rows, color based on positive/negative
    if (row.sectionType === 'result' || row.type === 'total' || row.type === 'sig') {
      return value >= 0 ? 'text-success' : 'text-destructive';
    }
    // For expense rows
    if (row.sectionType === 'expense' && value !== 0) {
      return 'text-red-700 dark:text-red-400';
    }
    // For revenue rows
    if (row.sectionType === 'revenue' && value > 0) {
      return 'text-emerald-700 dark:text-emerald-400';
    }
    // Legacy fallback
    if (row.isExpense && value !== 0) {
      return 'text-destructive';
    }
    if ((row.type === 'item' || row.type === 'subtotal') && !row.isExpense && value > 0) {
      return 'text-success';
    }
    return '';
  };

  const getIndentClass = (indent?: number) => {
    if (!indent) return '';
    if (indent === 1) return 'pl-6';
    if (indent === 2) return 'pl-10';
    return '';
  };

  // Get sticky cell background based on section type
  const getStickyBgClass = (row: PLRow) => {
    if (row.sectionType === 'revenue') {
      if (row.type === 'header') return 'bg-emerald-100 dark:bg-emerald-900/40';
      if (row.type === 'subtotal') return 'bg-emerald-50 dark:bg-emerald-900/20';
      return 'bg-emerald-50/50 dark:bg-emerald-900/10';
    }
    if (row.sectionType === 'expense') {
      if (row.type === 'header') return 'bg-red-100 dark:bg-red-900/40';
      if (row.type === 'subtotal') return 'bg-red-50 dark:bg-red-900/20';
      return 'bg-red-50/50 dark:bg-red-900/10';
    }
    if (row.sectionType === 'result') {
      if (row.type === 'total') return 'bg-primary/20';
      return 'bg-primary/10';
    }
    // Fallback
    if (row.type === 'header') return 'bg-muted/50';
    if (row.type === 'subtotal') return 'bg-muted/20';
    if (row.type === 'sig') return 'bg-primary/5';
    if (row.type === 'total') return 'bg-primary/10';
    return 'bg-background';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[320px]">Libellé</TableHead>
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
                  getStickyBgClass(row),
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
                        "text-center tabular-nums",
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
