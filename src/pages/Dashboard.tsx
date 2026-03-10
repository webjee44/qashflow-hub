import { PageHeader } from '@/components/layout/PageHeader';
import { BalanceChart } from '@/components/dashboard/BalanceChart';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { CalendlyPopup } from '@/components/onboarding/CalendlyPopup';
import { Wallet, Landmark } from 'lucide-react';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useBridgeAutoSync } from '@/hooks/useBridgeAutoSync';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useCompany } from '@/hooks/useCompany';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

interface AccountSummary {
  name: string;
  balance: number;
  bridge_account_id: number;
}

function useAssignedAccounts() {
  const { currentCompany } = useCompany();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!currentCompany?.id) {
        setAccounts([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data: assignments } = await supabase
        .from('company_bridge_accounts')
        .select('bridge_account_id')
        .eq('company_id', currentCompany.id);

      const ids = (assignments || []).map(a => a.bridge_account_id);
      if (ids.length === 0) {
        setAccounts([]);
        setLoading(false);
        return;
      }

      const { data: accs } = await supabase
        .from('bridge_accounts')
        .select('name, balance, bridge_account_id')
        .in('bridge_account_id', ids);

      setAccounts(
        (accs || []).map(a => ({
          name: a.name || 'Compte sans nom',
          balance: Number(a.balance) || 0,
          bridge_account_id: a.bridge_account_id,
        }))
      );
      setLoading(false);
    };
    fetch();
  }, [currentCompany?.id]);

  return { accounts, loading };
}

export default function Dashboard() {
  const { balance, isLoading: balanceLoading } = useBankBalance();
  const { accounts, loading: accountsLoading } = useAssignedAccounts();

  useBridgeAutoSync();

  const loading = balanceLoading || accountsLoading;

  return (
    <>
      <OnboardingTour />
      <CalendlyPopup />
      <div className="space-y-8" data-tour="dashboard">
        <PageHeader 
          title="Tableau de bord" 
          subtitle="Bienvenue ! Voici un aperçu de votre trésorerie." 
        />

        {/* Solde total + détail par banque */}
        <div data-tour="balance">
          {loading ? (
            <Skeleton className="h-36 rounded-2xl" />
          ) : (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="gradient-primary text-primary-foreground p-6 rounded-2xl border border-border shadow-card"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-primary-foreground/80">Solde total</p>
                  <p className="text-3xl font-bold tracking-tight text-primary-foreground">
                    {formatCurrency(balance)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-primary-foreground/20 text-primary-foreground">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>

              {accounts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-4 border-t border-primary-foreground/20">
                  {accounts.map((acc, i) => (
                    <motion.div
                      key={acc.bridge_account_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary-foreground/10"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Landmark className="w-3.5 h-3.5 shrink-0 text-primary-foreground/70" />
                        <span className="text-xs font-medium text-primary-foreground/80 truncate">{acc.name}</span>
                      </div>
                      <span className={cn(
                        "text-sm font-semibold whitespace-nowrap",
                        acc.balance >= 0 ? 'text-primary-foreground' : 'text-destructive'
                      )}>
                        {formatCurrency(acc.balance)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>

        <div data-tour="chart">
          <BalanceChart />
        </div>

        <div className="space-y-6">
          <div data-tour="transactions">
            <TransactionList />
          </div>
          <QuickActions />
        </div>
      </div>
    </>
  );
}
