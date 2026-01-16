import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { toast } from 'sonner';

export interface DeletedCompany {
  id: string;
  name: string;
  deleted_at: string;
  initial_balance: number;
}

export interface DeletedTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  deleted_at: string;
  company_id: string;
}

export function useTrash() {
  const { user } = useAuth();
  const { refetch: refetchCompanies } = useCompany();
  const queryClient = useQueryClient();

  // Fetch deleted companies
  const { data: deletedCompanies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['trash-companies', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('companies')
        .select('id, name, deleted_at, initial_balance')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DeletedCompany[];
    },
    enabled: !!user?.id,
  });

  // Fetch deleted transactions
  const { data: deletedTransactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['trash-transactions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('id, description, amount, type, date, deleted_at, company_id')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DeletedTransaction[];
    },
    enabled: !!user?.id,
  });

  // Restore company
  const restoreCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('companies')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-companies'] });
      refetchCompanies();
      toast.success('Société restaurée avec succès');
    },
    onError: (error) => {
      console.error('Error restoring company:', error);
      toast.error('Erreur lors de la restauration');
    },
  });

  // Restore transaction
  const restoreTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction restaurée avec succès');
    },
    onError: (error) => {
      console.error('Error restoring transaction:', error);
      toast.error('Erreur lors de la restauration');
    },
  });

  // Permanently delete company
  const permanentDeleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-companies'] });
      toast.success('Société supprimée définitivement');
    },
    onError: (error) => {
      console.error('Error permanently deleting company:', error);
      toast.error('Erreur lors de la suppression définitive');
    },
  });

  // Permanently delete transaction
  const permanentDeleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-transactions'] });
      toast.success('Transaction supprimée définitivement');
    },
    onError: (error) => {
      console.error('Error permanently deleting transaction:', error);
      toast.error('Erreur lors de la suppression définitive');
    },
  });

  return {
    deletedCompanies,
    deletedTransactions,
    isLoading: isLoadingCompanies || isLoadingTransactions,
    restoreCompany: restoreCompanyMutation.mutate,
    restoreTransaction: restoreTransactionMutation.mutate,
    permanentDeleteCompany: permanentDeleteCompanyMutation.mutate,
    permanentDeleteTransaction: permanentDeleteTransactionMutation.mutate,
    isRestoring: restoreCompanyMutation.isPending || restoreTransactionMutation.isPending,
    isDeleting: permanentDeleteCompanyMutation.isPending || permanentDeleteTransactionMutation.isPending,
  };
}