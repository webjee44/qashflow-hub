import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { BalanceChart } from '@/components/dashboard/BalanceChart';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Wallet, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <Header 
        title="Tableau de bord" 
        subtitle="Bienvenue ! Voici un aperçu de votre trésorerie." 
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Solde actuel"
          value="127 450 €"
          change={{ value: '+8.2%', type: 'positive' }}
          icon={Wallet}
          variant="primary"
          delay={0}
        />
        <StatCard
          title="Encaissements (jan)"
          value="49 700 €"
          change={{ value: '-9.6%', type: 'negative' }}
          icon={TrendingUp}
          variant="success"
          delay={0.05}
        />
        <StatCard
          title="Décaissements (jan)"
          value="38 539 €"
          change={{ value: '-3.5%', type: 'positive' }}
          icon={TrendingDown}
          delay={0.1}
        />
        <StatCard
          title="Prévision à 90 jours"
          value="156 800 €"
          change={{ value: '+23%', type: 'positive' }}
          icon={Calendar}
          delay={0.15}
        />
      </div>

      {/* Main Chart */}
      <BalanceChart />

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
