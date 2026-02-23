import { TransactionsView } from '@/components/transactions/TransactionsView';
import { useBridgeAutoSync } from '@/hooks/useBridgeAutoSync';

export default function Transactions() {
  useBridgeAutoSync();
  
  return (
    <div className="space-y-6">
      <TransactionsView />
    </div>
  );
}
