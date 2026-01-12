import { motion } from 'framer-motion';
import { transactions } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Sparkles, Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function TransactionList() {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="bg-card rounded-2xl border border-border shadow-card"
    >
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Dernières transactions</h3>
          <p className="text-sm text-muted-foreground">Synchronisées depuis Pennylane</p>
        </div>
        <button className="text-sm text-primary font-medium hover:underline">
          Voir tout →
        </button>
      </div>

      <div className="divide-y divide-border">
        {transactions.slice(0, 6).map((transaction, index) => (
          <motion.div
            key={transaction.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 * index }}
            className="p-4 hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                transaction.type === 'income' 
                  ? 'bg-success/10 text-success' 
                  : 'bg-destructive/10 text-destructive'
              )}>
                {transaction.type === 'income' 
                  ? <ArrowUpRight className="w-5 h-5" />
                  : <ArrowDownRight className="w-5 h-5" />
                }
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">
                    {transaction.description}
                  </p>
                  {transaction.aiConfidence && transaction.aiConfidence >= 0.9 && (
                    <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {transaction.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(transaction.date)}
                  </span>
                </div>
              </div>

              {/* Amount & Status */}
              <div className="text-right">
                <p className={cn(
                  "font-semibold",
                  transaction.type === 'income' ? 'text-success' : 'text-foreground'
                )}>
                  {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount)}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  {transaction.isReconciled ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-warning" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {transaction.isReconciled ? 'Validé' : 'En attente'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
