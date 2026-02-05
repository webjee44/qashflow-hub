import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

  // Get row classes - simplified 2-color scheme (muted + primary accent)
  const getRowClasses = (row: PLRow) => {
    // Headers - muted background
    if (row.type === 'header') {
      return 'bg-muted/60 font-bold text-foreground';
    }
    
    // Subtotals - light muted
    if (row.type === 'subtotal') {
      return 'bg-muted/30 font-semibold border-t border-border/50';
    }
    
    // SIG lines (key metrics) - primary accent
    if (row.type === 'sig') {
      return 'bg-primary/10 font-bold border-y border-primary/20';
    }
    
    // Final total - stronger primary accent
    if (row.type === 'total') {
      return 'bg-primary/15 font-bold text-lg border-y-2 border-primary/30';
    }
    
    // Regular items - no background
    return '';
  };

  const getValueClasses = (row: PLRow, value: number) => {
    // Only color key result lines (SIG, totals) based on positive/negative
    if (row.type === 'total' || row.type === 'sig') {
      return value >= 0 ? 'text-success' : 'text-destructive';
    }
    // All other values - neutral color
    return 'text-foreground';
  };

  const getIndentClass = (indent?: number) => {
    if (!indent) return '';
    if (indent === 1) return 'pl-6';
    if (indent === 2) return 'pl-10';
    return '';
  };

  // Get sticky cell background - simplified
  const getStickyBgClass = (row: PLRow) => {
    if (row.type === 'header') return 'bg-muted/60';
    if (row.type === 'subtotal') return 'bg-muted/30';
    if (row.type === 'sig') return 'bg-primary/10';
    if (row.type === 'total') return 'bg-primary/15';
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
            // Check if this is the "Achats de matières" row to show gross margin badge
            const isAchatsRow = row.label.includes('Achats de matières');
            
            return (
              <TableRow key={rowIndex} className={getRowClasses(row)}>
                <TableCell className={cn(
                  "sticky left-0 z-10",
                  getStickyBgClass(row),
                  getIndentClass(row.indent)
                )}>
                  <div className="flex items-center gap-2">
                    <span>{row.label}</span>
                    {isAchatsRow && data.totals.revenue[0] > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="text-xs font-medium bg-success/10 text-success border-success/20">
                              Marge brute : {((1 - (data.totals.cogs?.[0] || 0) / data.totals.revenue[0]) * 100).toFixed(1)}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Marge brute = (CA - Achats) / CA</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
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
