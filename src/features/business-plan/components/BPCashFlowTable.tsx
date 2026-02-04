import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useBPCashFlow, CashFlowMonthData } from '@/hooks/useBPCashFlow';
import { useBPSettings } from '@/hooks/useBPSettings';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface YearData {
  yearLabel: string;
  yearIndex: number;
  months: CashFlowMonthData[];
  totals: {
    inflows: number;
    outflows: number;
    netFlow: number;
  };
}

export function BPCashFlowTable() {
  const { data, isLoading } = useBPCashFlow();
  const { settings } = useBPSettings();
  const [openYears, setOpenYears] = useState<number[]>([0]); // Première année ouverte par défaut
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Grouper les données par année fiscale
  const bpYears = settings.bp_years || 3;
  const monthsPerYear = Math.ceil(data.monthlyData.length / bpYears);
  
  const yearGroups: YearData[] = [];
  for (let i = 0; i < bpYears; i++) {
    const startIdx = i * monthsPerYear;
    const endIdx = Math.min(startIdx + monthsPerYear, data.monthlyData.length);
    const yearMonths = data.monthlyData.slice(startIdx, endIdx);
    
    if (yearMonths.length > 0) {
      yearGroups.push({
        yearLabel: `Année ${i + 1}`,
        yearIndex: i,
        months: yearMonths,
        totals: {
          inflows: yearMonths.reduce((sum, m) => sum + m.inflows.total, 0),
          outflows: yearMonths.reduce((sum, m) => sum + m.outflows.total, 0),
          netFlow: yearMonths.reduce((sum, m) => sum + m.netFlow, 0),
        },
      });
    }
  }

  const toggleYear = (yearIndex: number) => {
    setOpenYears(prev => 
      prev.includes(yearIndex) 
        ? prev.filter(y => y !== yearIndex)
        : [...prev, yearIndex]
    );
  };

  const renderMonthRow = (monthData: CashFlowMonthData, isFirst: boolean) => (
    <TableRow key={monthData.monthLabel} className={cn(
      monthData.balance < 0 && 'bg-destructive/5'
    )}>
      <TableCell className="font-medium pl-8">
        {format(monthData.month, 'MMMM yyyy', { locale: fr })}
      </TableCell>
      <TableCell className="text-right text-success">
        {formatCurrency(monthData.inflows.total)}
      </TableCell>
      <TableCell className="text-right text-destructive">
        {formatCurrency(monthData.outflows.total)}
      </TableCell>
      <TableCell className={cn(
        "text-right font-medium",
        monthData.netFlow >= 0 ? 'text-success' : 'text-destructive'
      )}>
        <span className="inline-flex items-center gap-1">
          {monthData.netFlow >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {formatCurrency(monthData.netFlow)}
        </span>
      </TableCell>
      <TableCell className={cn(
        "text-right font-bold",
        monthData.balance >= 0 ? 'text-primary' : 'text-destructive'
      )}>
        {formatCurrency(monthData.balance)}
      </TableCell>
    </TableRow>
  );

  const renderDetailRows = (monthData: CashFlowMonthData) => {
    if (!showDetails) return null;

    const inflowDetails = [
      { label: 'CA encaissé', value: monthData.inflows.revenue },
      { label: 'Emprunts', value: monthData.inflows.loanDisbursements },
      { label: 'Apports capital', value: monthData.inflows.capitalContributions },
      { label: 'Subventions', value: monthData.inflows.grants },
      { label: 'Compte courant', value: monthData.inflows.currentAccountContributions },
    ].filter(d => d.value !== 0);

    const outflowDetails = [
      { label: 'Charges fixes', value: monthData.outflows.fixedExpenses },
      { label: 'Charges variables', value: monthData.outflows.variableExpenses },
      { label: 'Personnel', value: monthData.outflows.personnel },
      { label: 'Dirigeants', value: monthData.outflows.directors },
      { label: 'Taxes salaires', value: monthData.outflows.payrollTaxes },
      { label: 'Investissements', value: monthData.outflows.investments },
      { label: 'Remb. emprunts', value: monthData.outflows.loanPayments },
      { label: 'Crédit-bail', value: monthData.outflows.leasePayments },
      { label: 'TVA', value: monthData.outflows.vatPayments },
      { label: 'Impôts', value: monthData.outflows.taxPayments },
    ].filter(d => d.value !== 0);

    return (
      <>
        {inflowDetails.map(detail => (
          <TableRow key={`${monthData.monthLabel}-in-${detail.label}`} className="bg-success/5">
            <TableCell className="pl-12 text-sm text-muted-foreground">
              ↳ {detail.label}
            </TableCell>
            <TableCell className="text-right text-sm text-success/80">
              {formatCurrency(detail.value)}
            </TableCell>
            <TableCell colSpan={3}></TableCell>
          </TableRow>
        ))}
        {outflowDetails.map(detail => (
          <TableRow key={`${monthData.monthLabel}-out-${detail.label}`} className="bg-destructive/5">
            <TableCell className="pl-12 text-sm text-muted-foreground">
              ↳ {detail.label}
            </TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right text-sm text-destructive/80">
              {formatCurrency(detail.value)}
            </TableCell>
            <TableCell colSpan={2}></TableCell>
          </TableRow>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Masquer détails' : 'Afficher détails'}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Période</TableHead>
              <TableHead className="text-right">Encaissements</TableHead>
              <TableHead className="text-right">Décaissements</TableHead>
              <TableHead className="text-right">Flux net</TableHead>
              <TableHead className="text-right">Solde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Ligne initiale */}
            <TableRow className="bg-muted/30">
              <TableCell className="font-medium">Solde initial</TableCell>
              <TableCell colSpan={3}></TableCell>
              <TableCell className="text-right font-bold text-primary">
                {formatCurrency(data.initialBalance)}
              </TableCell>
            </TableRow>

            {yearGroups.map((yearGroup) => (
              <Collapsible 
                key={yearGroup.yearIndex}
                open={openYears.includes(yearGroup.yearIndex)}
                asChild
              >
                <>
                  {/* En-tête de l'année */}
                  <CollapsibleTrigger asChild>
                    <TableRow 
                      className="bg-muted/50 cursor-pointer hover:bg-muted/70"
                      onClick={() => toggleYear(yearGroup.yearIndex)}
                    >
                      <TableCell className="font-semibold">
                        <span className="inline-flex items-center gap-2">
                          {openYears.includes(yearGroup.yearIndex) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {yearGroup.yearLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-success">
                        {formatCurrency(yearGroup.totals.inflows)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {formatCurrency(yearGroup.totals.outflows)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        yearGroup.totals.netFlow >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {formatCurrency(yearGroup.totals.netFlow)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {yearGroup.months.length > 0 
                          ? formatCurrency(yearGroup.months[yearGroup.months.length - 1].balance)
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  </CollapsibleTrigger>

                  {/* Mois de l'année */}
                  <CollapsibleContent asChild>
                    <>
                      {yearGroup.months.map((monthData, idx) => (
                        <>
                          {renderMonthRow(monthData, idx === 0)}
                          {renderDetailRows(monthData)}
                        </>
                      ))}
                    </>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}

          </TableBody>
        </Table>
      </div>
    </div>
  );
}
