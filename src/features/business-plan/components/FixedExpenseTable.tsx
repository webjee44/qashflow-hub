import { useState } from 'react';
import { Edit, Trash2, Building2, Shield, Laptop, Megaphone, Zap, MoreHorizontal, Briefcase, CalendarClock, Copy, Filter, Phone, Landmark, Plane, Building, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBPFixedExpenses, BPFixedExpense, FIXED_EXPENSE_CATEGORIES, PAYMENT_FREQUENCIES } from '@/hooks/useBPFixedExpenses';
import { getPCGSubcategoryLabel } from '@/constants/bpConstants';
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
  telecom: <Phone className="h-4 w-4" />,
  banking: <Landmark className="h-4 w-4" />,
  travel: <Plane className="h-4 w-4" />,
  office: <Building className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function FixedExpenseTable({ onEdit }: FixedExpenseTableProps) {
  const { expenses, deleteExpense, createExpense, isLoading, getMonthlyAmount, totalMonthlyExpenses } = useBPFixedExpenses();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const handleDuplicate = (expense: BPFixedExpense) => {
    const { id, created_at, updated_at, user_id, company_id, ...expenseData } = expense;
    createExpense.mutate({
      ...expenseData,
      name: `${expense.name} (copie)`,
    });
  };

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

  // Filter and sort expenses
  const filteredExpenses = categoryFilter === 'all' 
    ? expenses 
    : expenses.filter(e => e.category === categoryFilter);
  
  const sortedExpenses = [...filteredExpenses].sort((a, b) => 
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  );

  // Calculate totals based on filtered expenses
  const filteredMonthlyTotal = filteredExpenses.reduce((sum, e) => sum + getMonthlyAmount(e), 0);
  const filteredAnnualTotal = filteredMonthlyTotal * 12;

  // Get unique categories from actual expenses for the filter dropdown
  const usedCategories = [...new Set(expenses.map(e => e.category))].sort();

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {usedCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                <span className="flex items-center gap-2">
                  {ICONS[cat]}
                  {FIXED_EXPENSE_CATEGORIES[cat as keyof typeof FIXED_EXPENSE_CATEGORIES]?.label || cat}
                </span>
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
            {filteredExpenses.length} charge{filteredExpenses.length > 1 ? 's' : ''} sur {expenses.length}
          </span>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Périodicité</TableHead>
            <TableHead className="text-right">Montant saisi</TableHead>
            <TableHead className="text-right">Équiv. mensuel</TableHead>
            <TableHead>Début</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead className="text-right">Total exercice</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedExpenses.map((expense) => {
            const frequencyInfo = PAYMENT_FREQUENCIES[expense.payment_frequency] || PAYMENT_FREQUENCIES.monthly;
            const monthlyAmount = getMonthlyAmount(expense);
            const annualTotal = monthlyAmount * 12;
            const isNonMonthly = expense.payment_frequency !== 'monthly';
            const paymentMonthsDisplay = expense.payment_months?.map(m => MONTH_NAMES[m - 1]).join(', ');
            
            return (
              <TableRow key={expense.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{expense.name}</span>
                    {expense.pcg_subcategory && (
                      <span className="text-xs text-muted-foreground">
                        {expense.pcg_subcategory} - {getPCGSubcategoryLabel(expense.category, expense.pcg_subcategory)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    {ICONS[expense.category]}
                    {FIXED_EXPENSE_CATEGORIES[expense.category as keyof typeof FIXED_EXPENSE_CATEGORIES]?.label || expense.category}
                  </Badge>
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
                <TableCell className="text-right font-semibold text-destructive">
                  {formatCurrency(Number(expense.monthly_amount))}
                  <span className="text-xs text-muted-foreground ml-1">
                    {expense.payment_frequency === 'annual' ? '/an' : '/mois'}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(monthlyAmount)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(expense.start_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {expense.end_date ? formatDate(expense.end_date) : '–'}
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatCurrency(annualTotal)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDuplicate(expense)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Dupliquer</TooltipContent>
                    </Tooltip>
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
    </div>
  );
}
