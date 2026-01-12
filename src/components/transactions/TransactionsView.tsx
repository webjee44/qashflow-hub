import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Check, 
  AlertCircle,
  Filter,
  Search,
  RefreshCw,
  Loader2,
  Tag,
  Building2,
  Wand2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { useCompany } from '@/hooks/useCompany';

type Transaction = Tables<'transactions'>;
type Category = Tables<'categories'>;

export function TransactionsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const { toast } = useToast();
  const { currentCompany } = useCompany();

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les transactions',
        variant: 'destructive',
      });
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*');

    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, []);

  const syncPennylane = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Erreur',
          description: 'Vous devez être connecté pour synchroniser',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('sync-pennylane', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Sync error:', error);
        toast({
          title: 'Erreur de synchronisation',
          description: error.message || 'Une erreur est survenue',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Synchronisation réussie',
          description: data.message || `${data.synced} transactions importées`,
        });
        fetchTransactions();
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de synchroniser avec Pennylane',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const updateTransactionCategory = async (transactionId: string, categoryId: string | null) => {
    const { error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .eq('id', transactionId);

    if (error) {
      console.error('Error updating category:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la catégorie',
        variant: 'destructive',
      });
    } else {
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? { ...t, category_id: categoryId } : t)
      );
      toast({
        title: 'Catégorie mise à jour',
        description: 'La transaction a été catégorisée avec succès',
      });
    }
  };

  const categorizeWithAI = async () => {
    const uncategorizedIds = transactions
      .filter(t => !t.category_id)
      .map(t => t.id);

    if (uncategorizedIds.length === 0) {
      toast({
        title: 'Aucune transaction à catégoriser',
        description: 'Toutes les transactions sont déjà catégorisées',
      });
      return;
    }

    setCategorizing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Erreur',
          description: 'Vous devez être connecté',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('categorize-transaction', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          transactionIds: uncategorizedIds,
          companyId: currentCompany?.id,
        },
      });

      if (error) {
        console.error('AI categorization error:', error);
        toast({
          title: 'Erreur de catégorisation',
          description: error.message || 'Une erreur est survenue',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Catégorisation IA terminée',
          description: `${data.categorized}/${data.total} transactions catégorisées`,
        });
        fetchTransactions();
      }
    } catch (err) {
      console.error('AI error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de catégoriser les transactions',
        variant: 'destructive',
      });
    } finally {
      setCategorizing(false);
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Non catégorisé';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Non catégorisé';
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return undefined;
    const category = categories.find(c => c.id === categoryId);
    return category?.color;
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const categoryName = getCategoryName(t.category_id);
    const matchesCategory = !selectedCategory || categoryName === selectedCategory;
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
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);

  const uniqueCategories = [...new Set(transactions.map(t => getCategoryName(t.category_id)))];

  // Group categories by type for the dropdown
  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Sync Button */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
        <div className="flex gap-2">
          <Button 
            onClick={categorizeWithAI} 
            disabled={categorizing}
            variant="outline"
            className="gap-2"
          >
            {categorizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            Catégoriser avec l'IA
          </Button>
          <Button onClick={syncPennylane} disabled={syncing}>
            {syncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Synchroniser Pennylane
          </Button>
        </div>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
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
        transition={{ delay: 0.2 }}
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

        {uniqueCategories.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-2 flex-wrap">
              {uniqueCategories.slice(0, 4).map(cat => (
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
        )}
      </motion.div>

      {/* Transactions List */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
      >
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">Aucune transaction trouvée</p>
            <p className="text-sm text-muted-foreground mt-2">
              Cliquez sur "Synchroniser Pennylane" pour importer vos transactions
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTransactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.05 * Math.min(index, 10) }}
                className="p-5 hover:bg-muted/30 transition-colors group"
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
                      {transaction.ai_confidence && (
                        <div className="flex items-center gap-1 text-accent">
                          <Sparkles className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            {Math.round(Number(transaction.ai_confidence) * 100)}% IA
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      {/* Quick Category Selector - 2 clicks */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 hover:bg-transparent"
                          >
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs cursor-pointer hover:bg-muted transition-colors",
                                !transaction.category_id && "border-dashed border-warning text-warning"
                              )}
                              style={transaction.category_id ? {
                                borderColor: getCategoryColor(transaction.category_id),
                                color: getCategoryColor(transaction.category_id),
                              } : undefined}
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              {getCategoryName(transaction.category_id)}
                            </Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          {transaction.category_id && (
                            <>
                              <DropdownMenuItem
                                onClick={() => updateTransactionCategory(transaction.id, null)}
                                className="text-muted-foreground"
                              >
                                Retirer la catégorie
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          
                          {incomeCategories.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                Encaissements
                              </div>
                              {incomeCategories.map(cat => (
                                <DropdownMenuItem
                                  key={cat.id}
                                  onClick={() => updateTransactionCategory(transaction.id, cat.id)}
                                  className="flex items-center gap-2"
                                >
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  {cat.name}
                                  {transaction.category_id === cat.id && (
                                    <Check className="w-4 h-4 ml-auto" />
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                          
                          {expenseCategories.length > 0 && (
                            <>
                              {incomeCategories.length > 0 && <DropdownMenuSeparator />}
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                Décaissements
                              </div>
                              {expenseCategories.map(cat => (
                                <DropdownMenuItem
                                  key={cat.id}
                                  onClick={() => updateTransactionCategory(transaction.id, cat.id)}
                                  className="flex items-center gap-2"
                                >
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  {cat.name}
                                  {transaction.category_id === cat.id && (
                                    <Check className="w-4 h-4 ml-auto" />
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                          
                          {categories.length === 0 && (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                              Aucune catégorie disponible.
                              <br />
                              Créez-en dans l'onglet Catégories.
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <span className="text-sm text-muted-foreground">
                        {formatDate(transaction.date)}
                      </span>
                      {transaction.source && (
                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                          {transaction.source}
                        </span>
                      )}
                      {transaction.bank_account_name && (
                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {transaction.bank_account_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount & Status */}
                  <div className="text-right">
                    <p className={cn(
                      "text-xl font-bold",
                      transaction.type === 'income' ? 'text-success' : 'text-foreground'
                    )}>
                      {transaction.type === 'income' ? '+' : '-'}{formatAmount(Number(transaction.amount))}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      {transaction.is_reconciled ? (
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
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
