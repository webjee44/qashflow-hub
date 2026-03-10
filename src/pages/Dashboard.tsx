import { PageHeader } from '@/components/layout/PageHeader';
import { BalanceChart } from '@/components/dashboard/BalanceChart';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { CalendlyPopup } from '@/components/onboarding/CalendlyPopup';
import { Wallet } from 'lucide-react';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useBridgeAutoSync } from '@/hooks/useBridgeAutoSync';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function Dashboard() {
  const { balance, isLoading: balanceLoading } = useBankBalance();

  useBridgeAutoSync();

  return (
    <>
      <OnboardingTour />
      <CalendlyPopup />
      <div className="space-y-8" data-tour="dashboard">
        <PageHeader 
          title="Tableau de bord" 
          subtitle="Bienvenue ! Voici un aperçu de votre trésorerie." 
        />

        {/* Solde total */}
        <div data-tour="balance">
          {balanceLoading ? (
            <Skeleton className="h-24 rounded-2xl" />
          ) : (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="gradient-primary text-primary-foreground p-6 rounded-2xl border border-border shadow-card"
            >
              <div className="flex items-start justify-between">
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
            </motion.div>
          )}
        </div>

        <div data-tour="chart">
          <BalanceChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div data-tour="transactions">
              <TransactionList />
            </div>
          </div>
          <div className="space-y-6">
            <CategoryBreakdown />
            <QuickActions />
          </div>
        </div>
      </div>
    </>
  );
}
