import { memo } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TransactionStatsBarProps {
  transactionCount: number;
  bankBalance: number;
  formatAmount: (amount: number) => string;
}

export const TransactionStatsBar = memo(function TransactionStatsBar({
  transactionCount,
  bankBalance,
  formatAmount,
}: TransactionStatsBarProps) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-2 gap-4"
    >
      <div className="bg-card rounded-xl border border-border p-4 shadow-card">
        <p className="text-sm text-muted-foreground">Transactions</p>
        <p className="text-2xl font-bold text-foreground">{transactionCount.toLocaleString('fr-FR')}</p>
      </div>
      <div className="bg-card rounded-xl border border-border p-4 shadow-card">
        <p className="text-sm text-muted-foreground">Solde bancaire</p>
        <p className={cn("text-2xl font-bold", bankBalance >= 0 ? "text-success" : "text-destructive")}>
          {formatAmount(bankBalance)}
        </p>
      </div>
    </motion.div>
  );
});
