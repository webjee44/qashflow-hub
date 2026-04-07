import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface CompanyAlert {
  severity: AlertSeverity;
  message: string;
}

export interface CompanyBalance {
  companyId: string;
  companyName: string;
  totalBalance: number;
  accountCount: number;
  accounts: Array<{
    name: string | null;
    balance: number;
    itemStatus: string | null;
    iban: string | null;
    accountType: string | null;
  }>;
  alerts: CompanyAlert[];
}

export interface GroupBalancesResult {
  companies: CompanyBalance[];
  consolidatedBalance: number;
  totalAlerts: number;
  criticalAlerts: number;
  isLoading: boolean;
}

function deriveAlerts(balance: number, accounts: CompanyBalance['accounts']): CompanyAlert[] {
  const alerts: CompanyAlert[] = [];

  if (accounts.length === 0) {
    alerts.push({ severity: 'info', message: 'Pas de banque liée' });
    return alerts;
  }

  if (balance < 0) {
    alerts.push({ severity: 'critical', message: 'Solde négatif' });
  }

  const hasError = accounts.some(a => a.itemStatus === 'error' || a.itemStatus === 'deleted');
  if (hasError) {
    alerts.push({ severity: 'critical', message: 'Connexion en erreur' });
  }

  const hasNeedsAction = accounts.some(a => a.itemStatus === 'needs_action');
  if (hasNeedsAction) {
    alerts.push({ severity: 'warning', message: 'Action requise' });
  }

  return alerts;
}

export function useGroupBalances(): GroupBalancesResult {
  const { companies: accessibleCompanies } = useCompany();

  const companyIds = accessibleCompanies.map(c => c.id);

  const query = useQuery({
    queryKey: ['group_balances', companyIds.sort().join(',')],
    queryFn: async (): Promise<CompanyBalance[]> => {
      if (companyIds.length === 0) return [];

      // Fetch all assigned bridge account IDs for these companies
      const { data: assignments, error: assignError } = await supabase
        .from('company_bridge_accounts')
        .select('company_id, bridge_account_id')
        .in('company_id', companyIds);

      if (assignError) throw assignError;

      const assignedIds = (assignments || []).map(a => a.bridge_account_id);

      // Fetch bridge accounts for all assigned IDs in one query
      let accountsMap: Record<string, CompanyBalance['accounts']> = {};

      if (assignedIds.length > 0) {
        const { data: bridgeAccounts, error: baError } = await supabase
          .from('bridge_accounts')
          .select('bridge_account_id, name, balance, item_status, iban, account_type, bank_name')
          .in('bridge_account_id', assignedIds);

        if (baError) throw baError;

        // Build a lookup: bridge_account_id → account data
        const accountById = new Map(
          (bridgeAccounts || []).map(ba => [
            ba.bridge_account_id,
            {
              name: ba.name,
              balance: Number(ba.balance) || 0,
              itemStatus: ba.item_status,
              iban: ba.iban,
              accountType: ba.account_type,
              bankName: ba.bank_name,
            },
          ])
        );

        // Group by company
        for (const a of assignments || []) {
          const acc = accountById.get(a.bridge_account_id);
          if (acc) {
            if (!accountsMap[a.company_id]) accountsMap[a.company_id] = [];
            accountsMap[a.company_id].push(acc);
          }
        }
      }

      return accessibleCompanies.map(company => {
        const accounts = accountsMap[company.id] || [];
        const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
        const alerts = deriveAlerts(totalBalance, accounts);

        return {
          companyId: company.id,
          companyName: company.name,
          totalBalance,
          accountCount: accounts.length,
          accounts,
          alerts,
        };
      });
    },
    enabled: companyIds.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const companies = query.data || [];
  const consolidatedBalance = companies.reduce((sum, c) => sum + c.totalBalance, 0);
  const totalAlerts = companies.reduce((sum, c) => sum + c.alerts.length, 0);
  const criticalAlerts = companies.reduce(
    (sum, c) => sum + c.alerts.filter(a => a.severity === 'critical').length,
    0
  );

  return {
    companies,
    consolidatedBalance,
    totalAlerts,
    criticalAlerts,
    isLoading: query.isLoading,
  };
}
