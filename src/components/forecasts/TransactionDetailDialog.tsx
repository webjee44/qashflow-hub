import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCategories, Category } from '@/hooks/useCategories';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category_id: string | null;
  type: 'income' | 'expense';
}

interface TransactionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryType: 'income' | 'expense';
  initialMonth: Date;
  forecastAmount: number;
}

export function TransactionDetailDialog({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  categoryColor,
  categoryType,
  initialMonth,
  forecastAmount,
}: TransactionDetailDialogProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { categories } = useCategories();
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Reset page when month changes
  useEffect(() => {
    setPage(1);
  }, [currentMonth]);

  // Reset month when dialog opens with new category
  useEffect(() => {
    if (open) {
      setCurrentMonth(initialMonth);
      setPage(1);
    }
  }, [open, initialMonth, categoryId]);

  // Format helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'd MMM yyyy', { locale: fr });
  };

  const formatMonthYear = (date: Date) => {
    return format(date, 'MMMM yyyy', { locale: fr });
  };

  // Fetch transactions for category and month
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transaction-detail', categoryId, format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!user?.id) return [];

      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(addMonths(startOfMonth(currentMonth), 1), 'yyyy-MM-dd');

      let query = supabase
        .from('transactions')
        .select('id, date, description, amount, category_id, type')
        .eq('category_id', categoryId)
        .gte('date', monthStart)
        .lt('date', monthEnd)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (currentCompany) {
        query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: open && !!user?.id && !!categoryId,
  });

  // Update transaction category mutation
  const updateTransactionCategory = useMutation({
    mutationFn: async ({ transactionId, newCategoryId }: { transactionId: string; newCategoryId: string | null }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: newCategoryId })
        .eq('id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-detail'] });
      queryClient.invalidateQueries({ queryKey: ['category-actuals'] });
      toast.success('Transaction recatégorisée');
    },
    onError: () => {
      toast.error('Erreur lors de la recatégorisation');
    },
  });

  // Calculate totals
  const actualTotal = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  }, [transactions]);

  const progressPercent = forecastAmount > 0
    ? Math.min((actualTotal / forecastAmount) * 100, 100)
    : 0;

  // Pagination
  const paginatedTransactions = useMemo(() => {
    return transactions.slice((page - 1) * pageSize, page * pageSize);
  }, [transactions, page, pageSize]);

  const totalPages = Math.ceil(transactions.length / pageSize);

  // Navigation handlers
  const handlePreviousMonth = () => {
    setCurrentMonth(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  // Filter categories for dropdown
  const availableCategories = useMemo(() => {
    return categories.filter(c => c.type === categoryType);
  }, [categories, categoryType]);

  const typeLabel = categoryType === 'income' ? 'Encaissements' : 'Décaissements';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{typeLabel}</span>
            <span>/</span>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: categoryColor }}
              />
              <span className="font-medium text-foreground">{categoryName}</span>
            </div>
          </div>

          {/* Month selector */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-semibold capitalize min-w-[180px] text-center">
              {formatMonthYear(currentMonth)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Summary section */}
        <div className="space-y-4 py-4 border-y border-border">
          {/* Total vs Budget */}
          <div className="text-center">
            <span className="text-2xl font-bold">
              {formatCurrency(actualTotal)}
            </span>
            <span className="text-muted-foreground mx-2">/</span>
            <span className="text-lg text-muted-foreground">
              {formatCurrency(forecastAmount)}
            </span>
          </div>

          {/* Progress bar */}
          <Progress value={progressPercent} className="h-2" />

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between items-center px-4 py-2 bg-muted/30 rounded-lg">
              <span className="text-muted-foreground">Réalisé ({progressPercent.toFixed(0)}%)</span>
              <span className={cn(
                "font-semibold",
                categoryType === 'income' ? "text-success" : "text-destructive"
              )}>
                {formatCurrency(actualTotal)}
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-2 bg-muted/30 rounded-lg">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-semibold">{formatCurrency(forecastAmount)}</span>
            </div>
          </div>
        </div>

        {/* Transactions table */}
        <div className="flex-1 overflow-auto min-h-0">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-background py-2">
            Transactions ({transactions.length})
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune transaction ce mois-ci
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="w-[180px]">Catégorie</TableHead>
                  <TableHead className="text-right w-[120px]">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {tx.description}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={tx.category_id || 'none'}
                          onValueChange={(value) => {
                            updateTransactionCategory.mutate({
                              transactionId: tx.id,
                              newCategoryId: value === 'none' ? null : value,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non catégorisé</SelectItem>
                            {availableCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  {cat.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {tx.category_id && (
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      categoryType === 'income' ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(Math.abs(tx.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} sur {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
