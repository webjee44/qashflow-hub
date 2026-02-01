import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';

/**
 * Hook to calculate the real-time bank balance for the current company
 * based on assigned bridge accounts in company_bridge_accounts
 */
export function useBankBalance() {
  const { currentCompany } = useCompany();

  const query = useQuery({
    queryKey: ['bank_balance', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { balance: 0, accountCount: 0 };

      // Get assigned bridge account IDs for this company
      const { data: assignments, error: assignError } = await supabase
        .from('company_bridge_accounts')
        .select('bridge_account_id')
        .eq('company_id', currentCompany.id);

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) {
        return { balance: 0, accountCount: 0 };
      }

      const assignedIds = assignments.map(a => a.bridge_account_id);

      // Get balances from bridge_accounts for assigned accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('bridge_accounts')
        .select('balance')
        .in('bridge_account_id', assignedIds);

      if (accountsError) throw accountsError;

      const totalBalance = accounts?.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) || 0;

      return {
        balance: totalBalance,
        accountCount: accounts?.length || 0,
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    balance: query.data?.balance ?? 0,
    accountCount: query.data?.accountCount ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
