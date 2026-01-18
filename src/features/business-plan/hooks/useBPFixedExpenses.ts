// ============================================
// useBPFixedExpenses Hook
// Uses fixedExpenseService for data operations
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  fixedExpenseService, 
  type BPFixedExpense, 
  type BPFixedExpenseInsert,
  FIXED_EXPENSE_CATEGORIES,
  PAYMENT_FREQUENCIES,
  DEFAULT_PAYMENT_MONTHS,
  type FixedExpenseCategory,
  type PaymentFrequency,
} from '@/services';

// Re-export types and constants for backward compatibility
export type { BPFixedExpense, FixedExpenseCategory, PaymentFrequency };
export { FIXED_EXPENSE_CATEGORIES, PAYMENT_FREQUENCIES, DEFAULT_PAYMENT_MONTHS };

export function useBPFixedExpenses(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['bp_fixed_expenses', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      return fixedExpenseService.getByBusinessPlanId(businessPlanId);
    },
    enabled: !!user && !!businessPlanId,
  });

  const createExpense = useMutation({
    mutationFn: async (data: BPFixedExpenseInsert) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');
      return fixedExpenseService.create(user.id, businessPlanId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', businessPlanId] });
      toast.success('Charge fixe créée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPFixedExpense> & { id: string }) => {
      await fixedExpenseService.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', businessPlanId] });
      toast.success('Charge fixe mise à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      await fixedExpenseService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', businessPlanId] });
      toast.success('Charge fixe supprimée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Use service utility methods
  const getMonthlyAmount = (expense: BPFixedExpense) => 
    fixedExpenseService.getMonthlyAmount(expense);
    
  const getCashOutflowForMonth = (expense: BPFixedExpense, month: Date) => 
    fixedExpenseService.getCashOutflowForMonth(expense, month);

  const totalMonthlyExpenses = fixedExpenseService.calculateTotalMonthlyExpenses(expenses);

  return {
    expenses,
    isLoading,
    createExpense,
    updateExpense,
    deleteExpense,
    totalMonthlyExpenses,
    categories: FIXED_EXPENSE_CATEGORIES,
    getMonthlyAmount,
    getCashOutflowForMonth,
  };
}
