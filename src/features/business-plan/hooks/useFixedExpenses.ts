import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, format, isWithinInterval, parseISO } from 'date-fns';

export interface FixedExpense {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  category: 'rent' | 'insurance' | 'software' | 'marketing' | 'utilities' | 'other';
  monthly_amount: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const EXPENSE_CATEGORIES = {
  rent: { label: 'Loyer', icon: 'Building2', color: 'hsl(220, 70%, 50%)' },
  insurance: { label: 'Assurances', icon: 'Shield', color: 'hsl(142, 70%, 45%)' },
  software: { label: 'Logiciels', icon: 'Laptop', color: 'hsl(270, 70%, 50%)' },
  marketing: { label: 'Marketing', icon: 'Megaphone', color: 'hsl(340, 70%, 50%)' },
  utilities: { label: 'Charges', icon: 'Zap', color: 'hsl(45, 70%, 50%)' },
  other: { label: 'Autres', icon: 'MoreHorizontal', color: 'hsl(0, 0%, 50%)' },
};

export function useFixedExpenses() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch fixed expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['bp_fixed_expenses', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_fixed_expenses')
        .select('*')
        .order('created_at', { ascending: true });

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FixedExpense[];
    },
    enabled: !!user,
  });

  // Create expense mutation
  const createExpense = useMutation({
    mutationFn: async (data: Partial<FixedExpense>) => {
      if (!user) throw new Error('Not authenticated');

      const { data: newExpense, error } = await supabase
        .from('bp_fixed_expenses')
        .insert({
          user_id: user.id,
          company_id: currentCompany?.id || null,
          name: data.name || 'Nouvelle charge',
          category: data.category || 'other',
          monthly_amount: data.monthly_amount || 0,
          start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
          end_date: data.end_date || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newExpense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses'] });
      toast({ title: 'Charge créée', description: 'La charge fixe a été ajoutée' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Update expense mutation
  const updateExpense = useMutation({
    mutationFn: async ({ id, ...data }: Partial<FixedExpense> & { id: string }) => {
      const { error } = await supabase
        .from('bp_fixed_expenses')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses'] });
      toast({ title: 'Charge mise à jour' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Delete expense mutation
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_fixed_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses'] });
      toast({ title: 'Charge supprimée' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Helper: check if expense is active for a given month
  const isExpenseActiveForMonth = (expense: FixedExpense, month: Date): boolean => {
    const monthStart = startOfMonth(month);
    const startDate = parseISO(expense.start_date);
    const endDate = expense.end_date ? parseISO(expense.end_date) : null;

    if (monthStart < startOfMonth(startDate)) return false;
    if (endDate && monthStart > startOfMonth(endDate)) return false;
    return true;
  };

  // Helper: get total fixed expenses for a month
  const getTotalForMonth = (month: Date): number => {
    return expenses
      .filter(e => isExpenseActiveForMonth(e, month))
      .reduce((sum, e) => sum + Number(e.monthly_amount), 0);
  };

  // Helper: get expenses by category
  const getExpensesByCategory = () => {
    const grouped: Record<string, FixedExpense[]> = {};
    expenses.forEach(e => {
      if (!grouped[e.category]) grouped[e.category] = [];
      grouped[e.category].push(e);
    });
    return grouped;
  };

  return {
    expenses,
    isLoading,
    createExpense,
    updateExpense,
    deleteExpense,
    isExpenseActiveForMonth,
    getTotalForMonth,
    getExpensesByCategory,
    EXPENSE_CATEGORIES,
  };
}
