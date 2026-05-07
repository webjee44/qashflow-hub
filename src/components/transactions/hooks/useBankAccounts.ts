import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';

export function useBankAccounts() {
  const { currentCompany } = useCompany();

  const { data: bridgeAccounts = [] } = useQuery({
    queryKey: ['bridge-accounts-authorized', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('company_active_bridge_accounts')
        .select('name, bank_name')
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000,
  });

  const bankAccountDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    bridgeAccounts.forEach(acc => {
      if (acc.name) {
        const display = acc.bank_name && acc.bank_name.toLowerCase() !== 'bridge' ? acc.bank_name : acc.name;
        map.set(acc.name, display);
      }
    });
    return map;
  }, [bridgeAccounts]);

  const accountToBankMap = useMemo(() => {
    const map = new Map<string, string>();
    bridgeAccounts.forEach(acc => {
      if (acc.name) {
        const bankName = acc.bank_name && acc.bank_name.toLowerCase() !== 'bridge' ? acc.bank_name : acc.name;
        map.set(acc.name, bankName);
      }
    });
    return map;
  }, [bridgeAccounts]);

  const uniqueBankNames = useMemo(() => {
    const bankSet = new Set<string>();
    bridgeAccounts.forEach(acc => {
      const bankName = acc.bank_name && acc.bank_name.toLowerCase() !== 'bridge' ? acc.bank_name : acc.name;
      if (bankName) bankSet.add(bankName);
    });
    return Array.from(bankSet).sort();
  }, [bridgeAccounts]);

  const getBankAccountDisplay = useCallback((accountName: string | null) => {
    if (!accountName) return null;
    return bankAccountDisplayMap.get(accountName) || accountName;
  }, [bankAccountDisplayMap]);

  return { accountToBankMap, uniqueBankNames, getBankAccountDisplay };
}
