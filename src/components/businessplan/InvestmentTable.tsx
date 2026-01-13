import { Edit, Trash2, Package, Car, Monitor, Building, Wrench } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useInvestments, Investment } from '@/hooks/useInvestments';
import { INVESTMENT_CATEGORIES, calculateMonthlyDepreciation } from '@/lib/french-rates';
import { format, parseISO, differenceInMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

interface InvestmentTableProps {
  onEdit: (investment: Investment) => void;
}

const ICONS: Record<string, React.ReactNode> = {
  equipment: <Wrench className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
  furniture: <Package className="h-4 w-4" />,
  software: <Monitor className="h-4 w-4" />,
  computer: <Monitor className="h-4 w-4" />,
  building: <Building className="h-4 w-4" />,
  other: <Package className="h-4 w-4" />,
};

export function InvestmentTable({ onEdit }: InvestmentTableProps) {
  const { investments, deleteInvestment, getNetBookValue, isLoading } = useInvestments();

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

  const getCategoryLabel = (cat: string) => {
    return INVESTMENT_CATEGORIES.find(c => c.value === cat)?.label || cat;
  };

  const getDepreciationProgress = (investment: Investment): number => {
    const purchaseDate = parseISO(investment.purchase_date);
    const totalMonths = investment.depreciation_years * 12;
    const monthsElapsed = differenceInMonths(new Date(), purchaseDate);
    return Math.min(100, Math.max(0, (monthsElapsed / totalMonths) * 100));
  };

  const totalGross = investments.reduce((sum, inv) => sum + Number(inv.purchase_amount), 0);
  const totalNetValue = investments.reduce((sum, inv) => sum + getNetBookValue(inv, new Date()), 0);
  const totalDepreciation = totalGross - totalNetValue;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (investments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Immobilisation</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Valeur brute</TableHead>
            <TableHead className="text-right">VNC</TableHead>
            <TableHead>Amortissement</TableHead>
            <TableHead>Fin amort.</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {investments.map((investment) => {
            const netValue = getNetBookValue(investment, new Date());
            const progress = getDepreciationProgress(investment);
            const endDate = addMonths(parseISO(investment.purchase_date), investment.depreciation_years * 12);
            const isFullyDepreciated = progress >= 100;

            return (
              <TableRow key={investment.id} className="group">
                <TableCell>
                  <div className="font-medium">{investment.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Acquis le {formatDate(investment.purchase_date)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    {ICONS[investment.category]}
                    {getCategoryLabel(investment.category)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(investment.purchase_amount))}
                </TableCell>
                <TableCell className="text-right">
                  <span className={isFullyDepreciated ? 'text-muted-foreground' : 'font-semibold'}>
                    {formatCurrency(netValue)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{investment.depreciation_method === 'linear' ? 'Lin.' : 'Dég.'}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {isFullyDepreciated ? (
                    <Badge variant="secondary" className="text-xs">Terminé</Badge>
                  ) : (
                    formatDate(endDate.toISOString())
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(investment)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteInvestment.mutate(investment.id)}
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
          <p className="text-sm text-muted-foreground">Valeur brute totale</p>
          <p className="text-lg font-semibold">{formatCurrency(totalGross)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Amortissements cumulés</p>
          <p className="text-lg font-semibold text-destructive">{formatCurrency(totalDepreciation)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Valeur nette comptable</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalNetValue)}</p>
        </div>
      </div>
    </div>
  );
}
