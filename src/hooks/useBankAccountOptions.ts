import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';

export interface BankAccountOption {
  name: string;
  bank_name: string | null;
  display: string;
}

/**
 * Returns the list of bank accounts for the current company,
 * suitable for use in selectors (automation rules, filters, etc.)
 */
export function useBankAccountOptions() {
  const { currentCompany } = useCompany();

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-account-options', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('company_active_bridge_accounts')
        .select('name, bank_name')
        .eq('company_id', currentCompany.id);

      if (error) throw error;

      return (data || [])
        .filter((a): a is { name: string; bank_name: string | null } => !!a.name)
        .map(a => ({
          name: a.name,
          bank_name: a.bank_name,
          display: a.bank_name && a.bank_name.toLowerCase() !== 'bridge'
            ? `${a.bank_name} – ${a.name}`
            : a.name,
        }));
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000,
  });

  return accounts;
}
