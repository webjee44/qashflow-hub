import { PageHeader } from '@/components/layout/PageHeader';
import { TransactionsView } from '@/components/transactions/TransactionsView';

export default function Transactions() {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Transactions" 
        subtitle="Toutes vos opérations synchronisées depuis Bridge" 
      />
      <TransactionsView />
    </div>
  );
}
