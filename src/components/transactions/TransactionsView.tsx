import { motion } from 'framer-motion';
import { transactions, categories } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Check, 
  AlertCircle,
  Filter,
  Search,
  ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function TransactionsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="grid grid-cols-3 gap-4"
      >
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Total encaissements</p>
          <p className="text-2xl font-bold text-success">{formatAmount(totalIncome)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Total décaissements</p>
          <p className="text-2xl font-bold text-destructive">{formatAmount(totalExpense)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Solde net</p>
          <p className={cn(
            "text-2xl font-bold",
            totalIncome - totalExpense >= 0 ? "text-primary" : "text-destructive"
          )}>
            {formatAmount(totalIncome - totalExpense)}
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une transaction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-2">
            {['Ventes', 'Salaires', 'Logiciels', 'Marketing'].map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Transactions List */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
      >
        <div className="divide-y divide-border">
          {filteredTransactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05 * index }}
              className="p-5 hover:bg-muted/30 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                  transaction.type === 'income' 
                    ? 'bg-success/10 text-success' 
                    : 'bg-destructive/10 text-destructive'
                )}>
                  {transaction.type === 'income' 
                    ? <ArrowUpRight className="w-6 h-6" />
                    : <ArrowDownRight className="w-6 h-6" />
                  }
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {transaction.description}
                    </p>
                    {transaction.aiConfidence && (
                      <div className="flex items-center gap-1 text-accent">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          {Math.round(transaction.aiConfidence * 100)}% IA
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Badge variant="outline" className="text-xs">
                      {transaction.category}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(transaction.date)}
                    </span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                      {transaction.source}
                    </span>
                  </div>
                </div>

                {/* Amount & Status */}
                <div className="text-right">
                  <p className={cn(
                    "text-xl font-bold",
                    transaction.type === 'income' ? 'text-success' : 'text-foreground'
                  )}>
                    {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount)}
                  </p>
                  <div className="flex items-center justify-end gap-1.5 mt-1">
                    {transaction.isReconciled ? (
                      <>
                        <Check className="w-4 h-4 text-success" />
                        <span className="text-sm text-success font-medium">Validé</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-warning" />
                        <span className="text-sm text-warning font-medium">En attente</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action */}
                <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
