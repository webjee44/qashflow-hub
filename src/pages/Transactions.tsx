import { PageHeader } from '@/components/layout/PageHeader';
import { TransactionsView } from '@/components/transactions/TransactionsView';
import { WelcomeGuide } from '@/components/onboarding/WelcomeGuide';
import { useTransactions } from '@/hooks/useTransactions';
import { useBridgeAutoSync } from '@/hooks/useBridgeAutoSync';

export default function Transactions() {
  const { transactions } = useTransactions();
  useBridgeAutoSync();
  
  return (
    <div className="space-y-8">
      <WelcomeGuide />
      <PageHeader 
        title="Transactions" 
        subtitle={`${transactions.length.toLocaleString('fr-FR')} opération${transactions.length > 1 ? 's' : ''} synchronisée${transactions.length > 1 ? 's' : ''}`}
      />
      <TransactionsView />
    </div>
  );
}
