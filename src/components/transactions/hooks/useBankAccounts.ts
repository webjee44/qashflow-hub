import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useBankAccounts() {
  const { data: bridgeAccounts = [] } = useQuery({
    queryKey: ['bridge-accounts-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bridge_accounts')
        .select('name, bank_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const bankAccountDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    bridgeAccounts.forEach(acc => {
      if (acc.name) map.set(acc.name, acc.name);
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
