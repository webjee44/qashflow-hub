import { PageHeader } from '@/components/layout/PageHeader';
import { TransactionsView } from '@/components/transactions/TransactionsView';
import { useTransactions } from '@/hooks/useTransactions';

export default function Transactions() {
  const { transactions } = useTransactions();
  
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Transactions" 
        subtitle={`${transactions.length.toLocaleString('fr-FR')} opération${transactions.length > 1 ? 's' : ''} synchronisée${transactions.length > 1 ? 's' : ''}`}
      />
      <TransactionsView />
    </div>
  );
}
