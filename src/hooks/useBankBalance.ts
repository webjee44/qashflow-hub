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

      // Source unique de vérité: vue company_active_bridge_accounts
      // (filtre déjà status='active' côté société + lifecycle_status='active' côté Bridge)
      const { data: accounts, error } = await supabase
        .from('company_active_bridge_accounts')
        .select('balance')
        .eq('company_id', currentCompany.id);

      if (error) throw error;

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
