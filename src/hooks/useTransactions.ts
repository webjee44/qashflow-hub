import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useCompany } from './useCompany';
import { logError } from '@/lib/logger';

type Transaction = Tables<'transactions'>;

export type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';

interface UseTransactionsOptions {
  limit?: number;
  enabled?: boolean;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const { limit, enabled = true } = options;

  const queryKey = ['transactions', currentCompany?.id, limit];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (currentCompany?.id) {
        q = q.eq('company_id', currentCompany.id);
      }

      if (limit) {
        q = q.limit(limit);
      }

      const { data, error } = await q;

      if (error) {
        logError('Error fetching transactions:', error);
        throw error;
      }

      return data || [];
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ transactionId, categoryId }: { transactionId: string; categoryId: string | null }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: categoryId })
        .eq('id', transactionId);

      if (error) throw error;
      return { transactionId, categoryId };
    },
    onMutate: async ({ transactionId, categoryId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      // Snapshot previous value
      const previousTransactions = queryClient.getQueryData<Transaction[]>(queryKey);

      // Optimistically update
      queryClient.setQueryData<Transaction[]>(queryKey, old => 
        old?.map(t => t.id === transactionId ? { ...t, category_id: categoryId } : t) || []
      );

      return { previousTransactions };
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKey, context.previousTransactions);
      }
      logError('Error updating transaction category:', err);
    },
    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const bulkUpdateCategoryMutation = useMutation({
    mutationFn: async ({ transactionIds, categoryId }: { transactionIds: string[]; categoryId: string | null }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: categoryId })
        .in('id', transactionIds);

      if (error) throw error;
      return { transactionIds, categoryId };
    },
    onMutate: async ({ transactionIds, categoryId }) => {
      // Cancel ALL transaction queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      
      // Snapshot previous data for rollback
      const previousTransactions = queryClient.getQueryData<Transaction[]>(queryKey);
      const idsSet = new Set(transactionIds);

      // Optimistically update ALL transaction query caches
      queryClient.setQueriesData<Transaction[]>(
        { queryKey: ['transactions'] },
        (old) => old?.map(t => idsSet.has(t.id) ? { ...t, category_id: categoryId } : t) || []
      );

      return { previousTransactions };
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKey, context.previousTransactions);
      }
      logError('Error bulk updating categories:', err);
    },
    onSettled: () => {
      // Invalidate to sync with server
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const splitTransactionMutation = useMutation({
    mutationFn: async ({
      originalTransactionId,
      splits,
    }: {
      originalTransactionId: string;
      splits: { categoryId: string | null; amount: number }[];
    }) => {
      // 1. Fetch original transaction
      const { data: original, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', originalTransactionId)
        .single();

      if (fetchError || !original) {
        throw new Error('Transaction originale introuvable');
      }

      // 2. Soft-delete the original transaction
      const { error: deleteError } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', originalTransactionId);

      if (deleteError) throw deleteError;

      // 3. Create new split transactions
      const newTransactions = splits.map((split, index) => ({
        user_id: original.user_id,
        company_id: original.company_id,
        date: original.date,
        type: original.type,
        amount: split.amount,
        category_id: split.categoryId,
        description: `${original.description} (${index + 1}/${splits.length})`,
        parent_transaction_id: originalTransactionId,
        source: 'split',
        is_reconciled: false,
      }));

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(newTransactions);

      if (insertError) throw insertError;

      return { originalTransactionId, splits };
    },
    onSuccess: () => {
      // Refetch transactions after split
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err) => {
      logError('Error splitting transaction:', err);
    },
  });

  return {
    transactions: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateCategory: updateCategoryMutation.mutateAsync,
    bulkUpdateCategory: bulkUpdateCategoryMutation.mutateAsync,
    splitTransaction: splitTransactionMutation.mutateAsync,
    isUpdating: updateCategoryMutation.isPending,
    isBulkUpdating: bulkUpdateCategoryMutation.isPending,
    isSplitting: splitTransactionMutation.isPending,
  };
}

// Sort helper
export function sortTransactions(transactions: Transaction[], sortOption: SortOption): Transaction[] {
  const sorted = [...transactions];
  
  switch (sortOption) {
    case 'date_desc':
      return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    case 'date_asc':
      return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    case 'amount_desc': {
      // Signed sort: income (positive) first, then expenses (negative)
      return sorted.sort((a, b) => {
        const amountA = a.type === 'income' ? Number(a.amount) : -Number(a.amount);
        const amountB = b.type === 'income' ? Number(b.amount) : -Number(b.amount);
        return amountB - amountA;
      });
    }
    case 'amount_asc': {
      // Signed sort: expenses (negative) first, then income (positive)
      return sorted.sort((a, b) => {
        const amountA = a.type === 'income' ? Number(a.amount) : -Number(a.amount);
        const amountB = b.type === 'income' ? Number(b.amount) : -Number(b.amount);
        return amountA - amountB;
      });
    }
    case 'name_asc':
      return sorted.sort((a, b) => a.description.localeCompare(b.description, 'fr', { sensitivity: 'base' }));
    case 'name_desc':
      return sorted.sort((a, b) => b.description.localeCompare(a.description, 'fr', { sensitivity: 'base' }));
    default:
      return sorted;
  }
}

// Filter helper
export function filterTransactions(
  transactions: Transaction[],
  options: {
    searchQuery?: string;
    categoryFilter?: string | null;
    getCategoryName: (categoryId: string | null) => string;
  }
): Transaction[] {
  const { searchQuery = '', categoryFilter, getCategoryName } = options;
  
  return transactions.filter(t => {
    const matchesSearch = !searchQuery || 
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const categoryName = getCategoryName(t.category_id);
    const matchesCategory = !categoryFilter || categoryName === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
}
