import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { BalanceChart } from '@/components/dashboard/BalanceChart';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { BankAccounts } from '@/components/dashboard/BankAccounts';
import { Wallet, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function Dashboard() {
  const { 
    currentBalance, 
    monthlyIncome, 
    monthlyExpense, 
    forecast90Days,
    incomeChange,
    expenseChange,
    loading 
  } = useDashboardStats();

  const currentMonth = format(new Date(), 'MMM', { locale: fr });

  return (
    <div className="space-y-8">
      <Header 
        title="Tableau de bord" 
        subtitle="Bienvenue ! Voici un aperçu de votre trésorerie." 
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </>
        ) : (
          <>
            <StatCard
              title="Solde actuel"
              value={formatCurrency(currentBalance)}
              icon={Wallet}
              variant="primary"
              delay={0}
            />
            <StatCard
              title={`Encaissements (${currentMonth})`}
              value={formatCurrency(monthlyIncome)}
              change={incomeChange}
              icon={TrendingUp}
              variant="success"
              delay={0.05}
            />
            <StatCard
              title={`Décaissements (${currentMonth})`}
              value={formatCurrency(monthlyExpense)}
              change={expenseChange}
              icon={TrendingDown}
              delay={0.1}
            />
            <StatCard
              title="Prévision à 90 jours"
              value={formatCurrency(forecast90Days)}
              icon={Calendar}
              delay={0.15}
            />
          </>
        )}
      </div>

      {/* Main Chart */}
      <BalanceChart />

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BankAccounts />
          <TransactionList />
        </div>
        <div className="space-y-6">
          <CategoryBreakdown />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
