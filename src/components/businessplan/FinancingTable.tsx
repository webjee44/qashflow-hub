import { Edit, Trash2, Landmark, FileText, Link2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Financing, useFinancings } from '@/hooks/useFinancings';
import { useInvestments } from '@/hooks/useInvestments';
import { calculateLoanPayment } from '@/lib/french-rates';
import { format, parseISO, differenceInMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FinancingTableProps {
  onEdit: (financing: Financing) => void;
}

export function FinancingTable({ onEdit }: FinancingTableProps) {
  const { financings, deleteFinancing, getTotalOutstandingLoans, getTotalMonthlyPayments, isLoading } = useFinancings();
  const { investments } = useInvestments();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'MMM yyyy', { locale: fr });
  };

  const getInvestmentName = (investmentId: string | null) => {
    if (!investmentId) return null;
    return investments.find(inv => inv.id === investmentId)?.name;
  };

  // Pour un BP prévisionnel, on affiche la durée totale du financement
  // plutôt que le temps restant par rapport à aujourd'hui
  const getDurationDisplay = (financing: Financing): { total: number; label: string } => {
    const durationMonths = financing.duration_months || 0;
    if (durationMonths === 0) return { total: 0, label: '—' };
    
    const years = Math.floor(durationMonths / 12);
    const months = durationMonths % 12;
    
    if (years > 0 && months > 0) {
      return { total: durationMonths, label: `${years} an${years > 1 ? 's' : ''} ${months} mois` };
    } else if (years > 0) {
      return { total: durationMonths, label: `${years} an${years > 1 ? 's' : ''}` };
    } else {
      return { total: durationMonths, label: `${months} mois` };
    }
  };

  const getRemainingCapital = (financing: Financing): number => {
    if (financing.financing_type !== 'loan') return 0;
    
    const startDate = parseISO(financing.start_date);
    const monthsElapsed = differenceInMonths(new Date(), startDate);
    
    if (monthsElapsed <= 0) return Number(financing.amount);
    if (monthsElapsed >= financing.duration_months) return 0;
    
    const monthlyRate = Number(financing.interest_rate) / 100 / 12;
    const { monthlyPayment } = calculateLoanPayment(
      Number(financing.amount),
      Number(financing.interest_rate),
      financing.duration_months
    );
    
    let remaining = Number(financing.amount);
    for (let i = 0; i < monthsElapsed; i++) {
      const interest = remaining * monthlyRate;
      remaining -= (monthlyPayment - interest);
    }
    
    return Math.max(0, remaining);
  };

  const totalOutstanding = getTotalOutstandingLoans();
  const totalMonthlyPayments = getTotalMonthlyPayments();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (financings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Financement</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Lié à</TableHead>
            <TableHead className="text-right">Mensualité</TableHead>
            <TableHead className="text-right">Restant dû</TableHead>
            <TableHead>Durée</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {financings.map((financing) => {
            const investmentName = getInvestmentName(financing.investment_id);
            const duration = getDurationDisplay(financing);
            const remainingCapital = getRemainingCapital(financing);

            return (
              <TableRow key={financing.id} className="group">
                <TableCell>
                  <div className="font-medium">{financing.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Depuis {formatDate(financing.start_date)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={financing.financing_type === 'loan' ? 'default' : 'secondary'} className="gap-1">
                    {financing.financing_type === 'loan' ? (
                      <>
                        <Landmark className="h-3 w-3" />
                        Emprunt
                      </>
                    ) : (
                      <>
                        <FileText className="h-3 w-3" />
                        Leasing
                      </>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  {investmentName ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                      {investmentName}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(financing.monthly_payment))}
                </TableCell>
                <TableCell className="text-right">
                  {financing.financing_type === 'loan' ? (
                    <span className={remainingCapital <= 0 ? 'text-muted-foreground' : ''}>
                      {formatCurrency(remainingCapital)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{duration.label}</span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(financing)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteFinancing.mutate(financing.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Summary */}
      <div className="flex justify-end gap-6 p-4 bg-muted/50 rounded-lg">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Mensualités totales</p>
          <p className="text-lg font-semibold">{formatCurrency(totalMonthlyPayments)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Encours total emprunts</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>
    </div>
  );
}
