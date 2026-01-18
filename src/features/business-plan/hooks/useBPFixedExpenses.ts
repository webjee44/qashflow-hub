// ============================================
// useBPFixedExpenses Hook
// Uses fixedExpenseService for data operations
// Now uses company_id instead of business_plan_id
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
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

export function useBPFixedExpenses() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['bp_fixed_expenses', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return fixedExpenseService.getByCompanyId(companyId);
    },
    enabled: !!user && !!companyId,
  });

  const createExpense = useMutation({
    mutationFn: async (data: BPFixedExpenseInsert) => {
      if (!user || !companyId) throw new Error('Not authenticated or no company');
      return fixedExpenseService.create(user.id, companyId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', companyId] });
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
