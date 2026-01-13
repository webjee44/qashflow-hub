import { Edit, Trash2, Building2, Shield, Laptop, Megaphone, Zap, MoreHorizontal } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFixedExpenses, FixedExpense, EXPENSE_CATEGORIES } from '@/hooks/useFixedExpenses';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FixedExpenseTableProps {
  onEdit: (expense: FixedExpense) => void;
}

const ICONS: Record<string, React.ReactNode> = {
  rent: <Building2 className="h-4 w-4" />,
  insurance: <Shield className="h-4 w-4" />,
  software: <Laptop className="h-4 w-4" />,
  marketing: <Megaphone className="h-4 w-4" />,
  utilities: <Zap className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

export function FixedExpenseTable({ onEdit }: FixedExpenseTableProps) {
  const { expenses, deleteExpense, isLoading } = useFixedExpenses();

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

  const totalMonthly = expenses.reduce((sum, e) => sum + Number(e.monthly_amount), 0);
  const totalAnnual = totalMonthly * 12;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (expenses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Montant/mois</TableHead>
            <TableHead>Début</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id} className="group">
              <TableCell className="font-medium">{expense.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1">
                  {ICONS[expense.category]}
                  {EXPENSE_CATEGORIES[expense.category].label}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold text-destructive">
                {formatCurrency(Number(expense.monthly_amount))}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(expense.start_date)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {expense.end_date ? formatDate(expense.end_date) : '–'}
              </TableCell>
              <TableCell>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(expense)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteExpense.mutate(expense.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Summary */}
      <div className="flex justify-end gap-6 p-4 bg-muted/50 rounded-lg">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total mensuel</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalMonthly)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total annuel</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalAnnual)}</p>
        </div>
      </div>
    </div>
  );
}
