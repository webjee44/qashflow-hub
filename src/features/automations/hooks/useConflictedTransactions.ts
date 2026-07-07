import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { fetchConflictedTransactions, type ConflictedTransactionInfo } from '../api/conflictedTransactionsApi';

export function useConflictedTransactions() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const query = useQuery({
    queryKey: ['conflicted-transactions', companyId],
    queryFn: async () => {
      if (!companyId) return new Map<string, ConflictedTransactionInfo>();
      return await fetchConflictedTransactions(companyId);
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });

  return {
    conflictMap: query.data ?? new Map<string, ConflictedTransactionInfo>(),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
