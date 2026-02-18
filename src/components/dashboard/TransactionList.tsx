import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Sparkles, Check, AlertCircle, Building2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Link } from 'react-router-dom';
import { useCompany } from '@/hooks/useCompany';
import { transactionApi } from '@/features/transactions/api/transactionApi';

type Transaction = Tables<'transactions'>;
type Category = Tables<'categories'>;

export function TransactionList() {
  const { currentCompany } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentCompany) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const categoriesQuery = supabase
        .from('categories')
        .select('*')
        .or(`company_id.eq.${currentCompany.id},company_id.is.null`);

      const [transactionsData, categoriesRes] = await Promise.all([
        transactionApi.getRecentByCompany(currentCompany.id, 6),
        categoriesQuery,
      ]);

      setTransactions(transactionsData);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      setLoading(false);
    };

    fetchData();
  }, [currentCompany]);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Non catégorisé';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Non catégorisé';
  };

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

  if (loading) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-2xl border border-border shadow-card p-12 flex items-center justify-center"
      >
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </motion.div>
    );
  }

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
          <p className="text-sm text-muted-foreground">
            {currentCompany ? currentCompany.name : 'Toutes les sociétés'}
          </p>
        </div>
        <Link to="/transactions" className="text-sm text-primary font-medium hover:underline">
          Voir tout →
        </Link>
      </div>

      <div className="divide-y divide-border">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>Aucune transaction</p>
            <p className="text-sm mt-1">Importez depuis Bridge pour voir vos opérations</p>
          </div>
        ) : (
          transactions.map((transaction, index) => (
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
                    {transaction.ai_confidence && Number(transaction.ai_confidence) >= 0.9 && (
                      <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {getCategoryName(transaction.category_id)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(transaction.date)}
                    </span>
                    {transaction.bank_account_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {transaction.bank_account_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount & Status */}
                <div className="text-right">
                  <p className={cn(
                    "font-semibold",
                    transaction.type === 'income' ? 'text-success' : 'text-foreground'
                  )}>
                    {transaction.type === 'income' ? '+' : '-'}{formatAmount(Number(transaction.amount))}
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
