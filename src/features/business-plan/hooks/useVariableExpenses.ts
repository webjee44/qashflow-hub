import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface VariableExpense {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  category: string;
  calculation_type: 'percentage' | 'per_unit';
  linked_revenue_stream_id: string | null;
  percentage: number;
  unit_cost: number;
  vat_rate: number;
  is_vat_deductible: boolean;
  is_cogs: boolean; // TRUE = Coût des ventes (impacte marge brute), FALSE = Charge d'exploitation
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const VARIABLE_EXPENSE_CATEGORIES = {
  cogs: { label: 'Coût des marchandises vendues', icon: 'Package', color: 'hsl(0, 72%, 51%)' },
  commission: { label: 'Commissions', icon: 'Users', color: 'hsl(262, 83%, 58%)' },
  delivery: { label: 'Frais de livraison', icon: 'Truck', color: 'hsl(199, 89%, 48%)' },
  transaction_fees: { label: 'Frais de transaction', icon: 'CreditCard', color: 'hsl(45, 93%, 47%)' },
  packaging: { label: 'Emballage', icon: 'Box', color: 'hsl(142, 71%, 45%)' },
  other: { label: 'Autres', icon: 'MoreHorizontal', color: 'hsl(215, 16%, 47%)' },
} as const;

export type VariableExpenseCategory = keyof typeof VARIABLE_EXPENSE_CATEGORIES;

export function useVariableExpenses() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const { user } = useAuth();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['variable-expenses', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('bp_variable_expenses')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name');
      
      if (error) throw error;
      return data as VariableExpense[];
    },
    enabled: !!currentCompany?.id,
  });

  const createExpense = useMutation({
    mutationFn: async (expense: Omit<VariableExpense, 'id' | 'user_id' | 'company_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id || !currentCompany?.id) throw new Error('Non authentifié');
      
      const { data, error } = await supabase
        .from('bp_variable_expenses')
        .insert({
          ...expense,
          user_id: user.id,
          company_id: currentCompany.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variable-expenses'] });
      toast.success('Charge variable créée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VariableExpense> & { id: string }) => {
      const { data, error } = await supabase
        .from('bp_variable_expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variable-expenses'] });
      toast.success('Charge variable mise à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_variable_expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variable-expenses'] });
      toast.success('Charge variable supprimée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const isExpenseActiveForMonth = (expense: VariableExpense, month: Date): boolean => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const startDate = new Date(expense.start_date);
    const endDate = expense.end_date ? new Date(expense.end_date) : null;

    if (startDate > monthStart) return false;
    if (endDate && endDate < monthStart) return false;
    return true;
  };

  const calculateVariableExpenseForMonth = (
    expense: VariableExpense,
    month: Date,
    revenueByStream: Map<string | null, { amount: number; units: number }>
  ): number => {
    if (!isExpenseActiveForMonth(expense, month)) return 0;

    // Get relevant revenue data
    let relevantAmount = 0;
    let relevantUnits = 0;

    if (expense.linked_revenue_stream_id) {
      // Linked to specific stream
      const streamData = revenueByStream.get(expense.linked_revenue_stream_id);
      if (streamData) {
        relevantAmount = streamData.amount;
        relevantUnits = streamData.units;
      }
    } else {
      // Applies to all streams
      revenueByStream.forEach((data) => {
        relevantAmount += data.amount;
        relevantUnits += data.units;
      });
    }

    if (expense.calculation_type === 'percentage') {
      return (relevantAmount * expense.percentage) / 100;
    } else {
      return relevantUnits * expense.unit_cost;
    }
  };

  const getExpensesByCategory = () => {
    return expenses.reduce((acc, expense) => {
      const category = expense.category as VariableExpenseCategory;
      if (!acc[category]) acc[category] = [];
      acc[category].push(expense);
      return acc;
    }, {} as Record<VariableExpenseCategory, VariableExpense[]>);
  };

  const getExpensesByStream = () => {
    return expenses.reduce((acc, expense) => {
      const streamId = expense.linked_revenue_stream_id || 'all';
      if (!acc[streamId]) acc[streamId] = [];
      acc[streamId].push(expense);
      return acc;
    }, {} as Record<string, VariableExpense[]>);
  };

  return {
    expenses,
    isLoading,
    createExpense,
    updateExpense,
    deleteExpense,
    isExpenseActiveForMonth,
    calculateVariableExpenseForMonth,
    getExpensesByCategory,
    getExpensesByStream,
    categories: VARIABLE_EXPENSE_CATEGORIES,
  };
}
