import { useState, useMemo } from 'react';
import { Edit, Trash2, Building2, Shield, Laptop, Megaphone, Zap, MoreHorizontal, Briefcase, CalendarClock, Copy, Filter, Phone, Landmark, Plane, Building, X, Percent, Hash, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useBPFixedExpenses, BPFixedExpense, FIXED_EXPENSE_CATEGORIES, PAYMENT_FREQUENCIES } from '@/hooks/useBPFixedExpenses';
import { useVariableExpenses, VariableExpense, VARIABLE_EXPENSE_CATEGORIES } from '@/hooks/useVariableExpenses';
import { useRevenueStreams } from '../hooks/useRevenueStreams';
import { useBPSettings } from '@/hooks/useBPSettings';
import { getPCGSubcategoryLabel } from '@/constants/bpConstants';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UnifiedExpense } from '../dialogs/ExpenseDialog';

interface ExpenseTableProps {
  onEdit: (expense: UnifiedExpense) => void;
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
  taxes: <Building className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
  // Variable categories
  cogs: <MoreHorizontal className="h-4 w-4" />,
  commission: <MoreHorizontal className="h-4 w-4" />,
  delivery: <MoreHorizontal className="h-4 w-4" />,
  transaction_fees: <MoreHorizontal className="h-4 w-4" />,
  packaging: <MoreHorizontal className="h-4 w-4" />,
};

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function ExpenseTable({ onEdit }: ExpenseTableProps) {
  const { 
    expenses: fixedExpenses, 
    deleteExpense: deleteFixed, 
    createExpense: createFixed, 
    isLoading: isLoadingFixed, 
    getMonthlyAmount 
  } = useBPFixedExpenses();
  
  const { 
    expenses: variableExpenses, 
    deleteExpense: deleteVariable, 
    isLoading: isLoadingVariable,
    calculateVariableExpenseForMonth,
  } = useVariableExpenses();

  const { streams, forecasts } = useRevenueStreams();
  const { settings } = useBPSettings();

  // Compute annual estimated € for each variable expense (Year 1)
  const variableEstimates = useMemo(() => {
    const estimates = new Map<string, number>();
    if (!settings.bp_start_date || !streams.length) return estimates;

    const startDate = new Date(settings.bp_start_date);
    const startMonth = settings.fiscal_year_start_month || (startDate.getMonth() + 1);
    const startYear = startDate.getFullYear();

    variableExpenses.forEach(expense => {
      let annualTotal = 0;
      for (let m = 0; m < 12; m++) {
        const monthDate = new Date(startYear, startMonth - 1 + m, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
        
        const revenueByStream = new Map<string | null, { amount: number; units: number }>();
        streams.forEach(stream => {
          const forecast = forecasts.find(f => f.stream_id === stream.id && f.month === monthKey);
          revenueByStream.set(stream.id, {
            amount: forecast?.amount || 0,
            units: forecast?.units || 0,
          });
        });

        annualTotal += calculateVariableExpenseForMonth(expense, monthDate, revenueByStream);
      }
      estimates.set(expense.id, annualTotal);
    });

    return estimates;
  }, [variableExpenses, streams, forecasts, settings, calculateVariableExpenseForMonth]);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<'name' | 'category' | 'amount' | 'start_date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deleteId, setDeleteId] = useState<{ id: string; type: 'fixed' | 'variable' } | null>(null);

  const toggleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleDuplicate = (expense: BPFixedExpense) => {
    const { id, created_at, updated_at, user_id, company_id, ...expenseData } = expense;
    createFixed.mutate({
      ...expenseData,
      name: `${expense.name} (copie)`,
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    if (deleteId.type === 'fixed') {
      deleteFixed.mutate(deleteId.id);
    } else {
      await deleteVariable.mutateAsync(deleteId.id);
    }
    setDeleteId(null);
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

  const getStreamName = (streamId: string | null) => {
    if (!streamId) return 'Tous les flux';
    const stream = streams.find(s => s.id === streamId);
    return stream?.name || 'Flux inconnu';
  };

  const formatVariableValue = (expense: VariableExpense) => {
    if (expense.calculation_type === 'percentage') {
      return `${expense.percentage}% du CA`;
    }
    return `${formatCurrency(expense.unit_cost)}/unité`;
  };

  if (isLoadingFixed || isLoadingVariable) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Merge and tag expenses
  const allExpenses: UnifiedExpense[] = [
    ...fixedExpenses.map(e => ({ ...e, expenseType: 'fixed' as const })),
    ...variableExpenses.map(e => ({ ...e, expenseType: 'variable' as const })),
  ];

  if (allExpenses.length === 0) {
    return null;
  }

  // Filter expenses
  const filteredExpenses = categoryFilter === 'all' 
    ? allExpenses 
    : allExpenses.filter(e => e.category === categoryFilter);
  
  // Sort expenses
  const getExpenseAmount = (e: UnifiedExpense): number => {
    if (e.expenseType === 'variable') {
      const estimate = variableEstimates.get(e.id);
      return estimate ?? 0;
    }
    return Number((e as BPFixedExpense).monthly_amount) || 0;
  };

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortColumn) {
      case 'name':
        return dir * a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
      case 'category':
        return dir * (a.category || '').localeCompare(b.category || '', 'fr');
      case 'amount':
        return dir * (getExpenseAmount(a) - getExpenseAmount(b));
      case 'start_date':
        return dir * (a.start_date.localeCompare(b.start_date));
      default:
        return 0;
    }
  });

  // Get unique categories for filter
  const usedCategories = [...new Set(allExpenses.map(e => e.category))].sort();

  // Get category label helper
  const getCategoryLabel = (category: string, isVariable: boolean) => {
    if (isVariable) {
      return VARIABLE_EXPENSE_CATEGORIES[category as keyof typeof VARIABLE_EXPENSE_CATEGORIES]?.label || category;
    }
    return FIXED_EXPENSE_CATEGORIES[category as keyof typeof FIXED_EXPENSE_CATEGORIES]?.label || category;
  };

  return (
    <TooltipProvider>
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
              {usedCategories.map((cat) => {
                const isVariable = variableExpenses.some(e => e.category === cat);
                return (
                  <SelectItem key={cat} value={cat}>
                    <span className="flex items-center gap-2">
                      {ICONS[cat] || <MoreHorizontal className="h-4 w-4" />}
                      {getCategoryLabel(cat, isVariable)}
                    </span>
                  </SelectItem>
                );
              })}
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
              {filteredExpenses.length} charge{filteredExpenses.length > 1 ? 's' : ''} sur {allExpenses.length}
            </span>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('name')}>
                <span className="flex items-center">Nom<SortIcon column="name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('category')}>
                <span className="flex items-center">Catégorie<SortIcon column="category" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('amount')}>
                <span className="flex items-center">Montant / Valeur<SortIcon column="amount" /></span>
              </TableHead>
              <TableHead>Période / Flux</TableHead>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('start_date')}>
                <span className="flex items-center">Début<SortIcon column="start_date" /></span>
              </TableHead>
              <TableHead>Fin</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedExpenses.map((expense) => {
              const isVariable = expense.expenseType === 'variable';
              
              if (isVariable) {
                const varExpense = expense as VariableExpense & { expenseType: 'variable' };
                return (
                  <TableRow key={`var-${varExpense.id}`} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{varExpense.name}</span>
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0">
                          <Percent className="h-3 w-3 mr-1" />
                          Variable
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {ICONS[varExpense.category] || <MoreHorizontal className="h-4 w-4" />}
                        {VARIABLE_EXPENSE_CATEGORIES[varExpense.category as keyof typeof VARIABLE_EXPENSE_CATEGORIES]?.label || varExpense.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {varExpense.calculation_type === 'percentage' ? (
                            <span className="font-mono text-destructive">{varExpense.percentage}% du CA</span>
                          ) : (
                            <span className="font-mono text-destructive">{formatCurrency(varExpense.unit_cost)}/unité</span>
                          )}
                        </div>
                        {(() => {
                          const estimate = variableEstimates.get(varExpense.id);
                          return estimate != null && estimate > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              ≈ {formatCurrency(estimate)}/an
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Aucun CA prévu
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getStreamName(varExpense.linked_revenue_stream_id)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(varExpense.start_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {varExpense.end_date ? formatDate(varExpense.end_date) : '–'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit(varExpense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId({ id: varExpense.id, type: 'variable' })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              } else {
                const fixExpense = expense as BPFixedExpense & { expenseType: 'fixed' };
                const frequencyInfo = PAYMENT_FREQUENCIES[fixExpense.payment_frequency] || PAYMENT_FREQUENCIES.monthly;
                const monthlyAmount = getMonthlyAmount(fixExpense);
                const isNonMonthly = fixExpense.payment_frequency !== 'monthly';
                const paymentMonthsDisplay = fixExpense.payment_months?.map(m => MONTH_NAMES[m - 1]).join(', ');
                
                return (
                  <TableRow key={`fix-${fixExpense.id}`} className="group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{fixExpense.name}</span>
                        {fixExpense.pcg_subcategory && (
                          <span className="text-xs text-muted-foreground">
                            {fixExpense.pcg_subcategory} - {getPCGSubcategoryLabel(fixExpense.category, fixExpense.pcg_subcategory)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {ICONS[fixExpense.category] || <MoreHorizontal className="h-4 w-4" />}
                        {FIXED_EXPENSE_CATEGORIES[fixExpense.category as keyof typeof FIXED_EXPENSE_CATEGORIES]?.label || fixExpense.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-destructive">
                          {formatCurrency(Number(fixExpense.monthly_amount))}
                          <span className="text-xs text-muted-foreground ml-1 font-normal">
                            /{frequencyInfo.label.toLowerCase().slice(0, 4)}
                          </span>
                        </span>
                        {isNonMonthly && (
                          <span className="text-xs text-muted-foreground">
                            ≈ {formatCurrency(monthlyAmount)}/mois
                          </span>
                        )}
                      </div>
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
                      {formatDate(fixExpense.start_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fixExpense.end_date ? formatDate(fixExpense.end_date) : '–'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDuplicate(fixExpense)}
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
                          onClick={() => onEdit(fixExpense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId({ id: fixExpense.id, type: 'fixed' })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }
            })}
          </TableBody>
        </Table>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette charge ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. La charge sera définitivement supprimée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
