import { useState } from 'react';
import { Edit, Trash2, Building2, Shield, Laptop, Megaphone, Zap, MoreHorizontal, Briefcase, CalendarClock, X, Filter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBPFixedExpenses, BPFixedExpense, FIXED_EXPENSE_CATEGORIES, PAYMENT_FREQUENCIES } from '@/hooks/useBPFixedExpenses';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FixedExpenseTableProps {
  onEdit: (expense: BPFixedExpense) => void;
}

const ICONS: Record<string, React.ReactNode> = {
  rent: <Building2 className="h-4 w-4" />,
  insurance: <Shield className="h-4 w-4" />,
  software: <Laptop className="h-4 w-4" />,
  marketing: <Megaphone className="h-4 w-4" />,
  utilities: <Zap className="h-4 w-4" />,
  professional_fees: <Briefcase className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function FixedExpenseTable({ onEdit }: FixedExpenseTableProps) {
  const { expenses, deleteExpense, isLoading, getMonthlyAmount, totalMonthlyExpenses } = useBPFixedExpenses();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

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

  // Filter expenses by category
  const filteredExpenses = categoryFilter === 'all'
    ? expenses
    : expenses.filter(e => e.category === categoryFilter);

  // Get unique categories from actual expenses for filter dropdown
  const usedCategories = [...new Set(expenses.map(e => e.category))].filter(Boolean);

  // Calculate totals for filtered expenses
  const filteredMonthlyTotal = filteredExpenses.reduce((sum, expense) => sum + getMonthlyAmount(expense), 0);
  const filteredAnnualTotal = filteredMonthlyTotal * 12;

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
      {/* Category Filter */}
      {usedCategories.length > 1 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrer par catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {usedCategories.map((cat) => (
                <SelectItem key={cat} value={cat!}>
                  {FIXED_EXPENSE_CATEGORIES[cat as keyof typeof FIXED_EXPENSE_CATEGORIES]?.label || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoryFilter !== 'all' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCategoryFilter('all')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {categoryFilter !== 'all' && (
            <span className="text-sm text-muted-foreground">
              {filteredExpenses.length} charge{filteredExpenses.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Périodicité</TableHead>
            <TableHead>Début</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredExpenses.map((expense) => {
            const frequencyInfo = PAYMENT_FREQUENCIES[expense.payment_frequency] || PAYMENT_FREQUENCIES.monthly;
            const isNonMonthly = expense.payment_frequency !== 'monthly';
            const paymentMonthsDisplay = expense.payment_months?.map(m => MONTH_NAMES[m - 1]).join(', ');
            
            return (
              <TableRow key={expense.id} className="group">
                <TableCell className="font-medium">{expense.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    {ICONS[expense.category]}
                    {FIXED_EXPENSE_CATEGORIES[expense.category as keyof typeof FIXED_EXPENSE_CATEGORIES]?.label || expense.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatCurrency(Number(expense.monthly_amount))}
                  {isNonMonthly && (
                    <span className="text-xs text-muted-foreground ml-1">/{frequencyInfo.label.toLowerCase().slice(0, 4)}</span>
                  )}
                </TableCell>
                <TableCell>
                  {isNonMonthly ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="secondary" className="gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {frequencyInfo.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mois de paiement : {paymentMonthsDisplay || 'Non défini'}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground text-sm">Mensuel</span>
                  )}
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
            );
          })}
        </TableBody>
      </Table>

      {/* Summary */}
      <div className="flex justify-end gap-6 p-4 bg-muted/50 rounded-lg">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Total mensuel {categoryFilter !== 'all' ? '(filtré)' : '(lissé)'}
          </p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(filteredMonthlyTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Total annuel {categoryFilter !== 'all' ? '(filtré)' : ''}
          </p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(filteredAnnualTotal)}</p>
        </div>
      </div>
    </div>
  );
}
