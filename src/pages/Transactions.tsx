import { Header } from '@/components/layout/Header';
import { TransactionsView } from '@/components/transactions/TransactionsView';

export default function Transactions() {
  return (
    <div className="space-y-8">
      <Header 
        title="Transactions" 
        subtitle="Toutes vos opérations synchronisées depuis Pennylane" 
      />
      <TransactionsView />
    </div>
  );
}
