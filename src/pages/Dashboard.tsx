import { PageHeader } from '@/components/layout/PageHeader';
import { BalanceChart } from '@/components/dashboard/BalanceChart';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { CalendlyPopup } from '@/components/onboarding/CalendlyPopup';
import { Wallet, Landmark, MoreHorizontal, EyeOff } from 'lucide-react';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useBridgeAutoSync } from '@/hooks/useBridgeAutoSync';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useCompany } from '@/hooks/useCompany';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

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
  iban: string | null;
}

function maskIban(iban: string | null): string {
  if (!iban) return '';
  const trimmed = iban.replace(/\s+/g, '');
  if (trimmed.length <= 4) return `••${trimmed}`;
  return `••${trimmed.slice(-4)}`;
}

function useAssignedAccounts() {
  const { currentCompany } = useCompany();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentCompany?.id) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Source unique = vue company_active_bridge_accounts
    const { data: rows } = await supabase
      .from('company_active_bridge_accounts')
      .select('name, balance, bridge_account_id, iban')
      .eq('company_id', currentCompany.id);

    setAccounts(
      (rows || []).map(a => ({
        name: a.name || 'Compte sans nom',
        balance: Number(a.balance) || 0,
        bridge_account_id: a.bridge_account_id,
        iban: a.iban,
      }))
    );
    setLoading(false);
  }, [currentCompany?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { accounts, loading, refetch: fetch };
}

export default function Dashboard() {
  const { balance, isLoading: balanceLoading, refetch: refetchBalance } = useBankBalance();
  const { accounts, loading: accountsLoading, refetch: refetchAccounts } = useAssignedAccounts();
  const { currentCompany } = useCompany();

  useBridgeAutoSync();

  const loading = balanceLoading || accountsLoading;

  // Masquer un compte = décision métier persistante (status='excluded' sur company_bridge_accounts).
  // On ne supprime PAS l'assignation (sinon l'auto-assign la recréerait à la prochaine sync).
  // On ne touche PAS à bridge_accounts.lifecycle_status (état technique géré par bridge-sync).
  const handleHideAccount = async (bridgeAccountId: number, name: string) => {
    if (!currentCompany?.id) return;
    try {
      const { error } = await supabase
        .from('company_bridge_accounts')
        .update({
          status: 'excluded',
          excluded_at: new Date().toISOString(),
          exclusion_reason: 'Masqué depuis le tableau de bord',
        })
        .eq('company_id', currentCompany.id)
        .eq('bridge_account_id', bridgeAccountId);
      if (error) throw error;

      // Trigger trg_recompute_on_cba_change recalcule companies.bank_balance automatiquement.
      toast.success(`Compte « ${name} » masqué`);
      await Promise.all([refetchAccounts(), refetchBalance()]);
    } catch (e) {
      logError('Hide account failed', e);
      toast.error('Impossible de masquer ce compte');
    }
  };

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
                      className="group flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary-foreground/10"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Landmark className="w-3.5 h-3.5 shrink-0 text-primary-foreground/70" />
                        <span className="text-xs font-medium text-primary-foreground/80 truncate">{acc.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "text-sm font-semibold whitespace-nowrap",
                          acc.balance >= 0 ? 'text-primary-foreground' : 'text-destructive'
                        )}>
                          {formatCurrency(acc.balance)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Options du compte"
                              className="p-1 rounded-md text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleHideAccount(acc.bridge_account_id, acc.name)}
                            >
                              <EyeOff className="w-4 h-4 mr-2" />
                              Masquer ce compte
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
