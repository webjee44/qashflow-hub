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
  Wand2,
  PlusCircle,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  CheckSquare,
  Square,
  X
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { useCompany } from '@/hooks/useCompany';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { SuggestAutomationDialog } from './SuggestAutomationDialog';
import { CategoryDialog } from '@/components/categories/CategoryDialog';

type Transaction = Tables<'transactions'>;
type Category = Tables<'categories'>;

export function TransactionsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortByName, setSortByName] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const transactionsRef = useRef<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [lastCategorizedTransaction, setLastCategorizedTransaction] = useState<Transaction | null>(null);
  const [lastSelectedCategory, setLastSelectedCategory] = useState<Category | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [bulkCategorizing, setBulkCategorizing] = useState(false);
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { createRule } = useAutomationRules();

  const fetchTransactions = async () => {
    setLoading(true);
    
    let query = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    // Filtrer par société si une est sélectionnée
    if (currentCompany?.id) {
      query = query.eq('company_id', currentCompany.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les transactions',
        variant: 'destructive',
      });
    } else {
      const next = data || [];
      transactionsRef.current = next;
      setTransactions(next);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    let query = supabase
      .from('categories')
      .select('*');

    // Filtrer par société (inclure aussi les catégories sans société)
    if (currentCompany?.id) {
      query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, [currentCompany?.id]);

  const syncPennylane = async () => {
    if (!currentCompany) {
      toast({
        title: 'Aucune société sélectionnée',
        description: 'Veuillez sélectionner ou créer une société dans les paramètres',
        variant: 'destructive',
      });
      return;
    }

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
        body: {
          company_id: currentCompany.id,
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
    const transaction = transactionsRef.current.find(t => t.id === transactionId);
    const previousCategoryId = transaction?.category_id;

    // Optimistic update - mise à jour immédiate de l'UI (et du ref)
    const nextTransactions = transactionsRef.current.map(t =>
      t.id === transactionId ? { ...t, category_id: categoryId } : t
    );
    transactionsRef.current = nextTransactions;
    setTransactions(nextTransactions);

    const { error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .eq('id', transactionId);

    if (error) {
      console.error('Error updating category:', error);
      // Rollback en cas d'erreur
      const rollbackTransactions = transactionsRef.current.map(t =>
        t.id === transactionId ? { ...t, category_id: previousCategoryId ?? null } : t
      );
      transactionsRef.current = rollbackTransactions;
      setTransactions(rollbackTransactions);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la catégorie',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Catégorie mise à jour',
        description: 'La transaction a été catégorisée avec succès',
      });
      
      // Si on assigne une catégorie (pas si on la retire), proposer l'automatisation
      if (categoryId && !previousCategoryId && transaction) {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
          setLastCategorizedTransaction({ ...transaction, category_id: categoryId });
          setLastSelectedCategory(category);
          setShowSuggestDialog(true);
        }
      }
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

  const filteredTransactions = transactions
    .filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const categoryName = getCategoryName(t.category_id);
      const matchesCategory = !selectedCategory || categoryName === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortByName) {
        return a.description.localeCompare(b.description, 'fr', { sensitivity: 'base' });
      }
      // Default: sort by date descending
      return new Date(b.date).getTime() - new Date(a.date).getTime();
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

  const uncategorizedCount = transactions.filter(t => !t.category_id).length;

  // Group categories by type for the dropdown
  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Bulk selection helpers
  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactionIds(prev => {
      const next = new Set(prev);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const allVisibleIds = filteredTransactions.map(t => t.id);
    setSelectedTransactionIds(new Set(allVisibleIds));
  };

  const clearSelection = () => {
    setSelectedTransactionIds(new Set());
  };

  const bulkUpdateCategory = async (categoryId: string | null) => {
    if (selectedTransactionIds.size === 0) return;

    setBulkCategorizing(true);
    const idsArray = Array.from(selectedTransactionIds);
    
    // Optimistic update
    const previousTransactions = [...transactionsRef.current];
    const nextTransactions = transactionsRef.current.map(t =>
      selectedTransactionIds.has(t.id) ? { ...t, category_id: categoryId } : t
    );
    transactionsRef.current = nextTransactions;
    setTransactions(nextTransactions);

    const { error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .in('id', idsArray);

    if (error) {
      console.error('Error bulk updating categories:', error);
      // Rollback
      transactionsRef.current = previousTransactions;
      setTransactions(previousTransactions);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour les catégories',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Catégories mises à jour',
        description: `${idsArray.length} transaction${idsArray.length > 1 ? 's' : ''} catégorisée${idsArray.length > 1 ? 's' : ''}`,
      });
      clearSelection();
    }
    setBulkCategorizing(false);
  };

  const isAllVisibleSelected = filteredTransactions.length > 0 && 
    filteredTransactions.every(t => selectedTransactionIds.has(t.id));

  // Create category handler
  const handleCreateCategory = async (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: newCategory, error } = await supabase
      .from('categories')
      .insert({
        name: data.name,
        color: data.color,
        icon: data.icon,
        type: data.type,
        user_id: user.id,
        company_id: currentCompany?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la catégorie',
        variant: 'destructive',
      });
      return null;
    }

    // Add the new category to the list
    setCategories(prev => [...prev, newCategory]);
    
    toast({
      title: 'Catégorie créée',
      description: `La catégorie "${data.name}" a été créée`,
    });

    // If there's a pending transaction, assign the category
    if (pendingTransactionId) {
      await updateTransactionCategory(pendingTransactionId, newCategory.id);
      setPendingTransactionId(null);
    }

    return newCategory;
  };

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

        <Button
          variant={sortByName ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortByName(!sortByName)}
          className="gap-2"
        >
          {sortByName ? (
            <ArrowDownAZ className="w-4 h-4" />
          ) : (
            <ArrowDownWideNarrow className="w-4 h-4" />
          )}
          {sortByName ? 'Trié par nom' : 'Trier par nom'}
        </Button>

        <Button
          variant={selectedCategory === 'Non catégorisé' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(selectedCategory === 'Non catégorisé' ? null : 'Non catégorisé')}
          className="relative"
        >
          Non catégorisé
          {uncategorizedCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold px-1.5">
              {uncategorizedCount}
            </span>
          )}
        </Button>

        {/* Bulk selection toggle */}
        <Button
          variant={selectedTransactionIds.size > 0 ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            if (selectedTransactionIds.size > 0) {
              clearSelection();
            } else {
              selectAllVisible();
            }
          }}
          className="gap-2"
        >
          {selectedTransactionIds.size > 0 ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          {selectedTransactionIds.size > 0 
            ? `${selectedTransactionIds.size} sélectionné${selectedTransactionIds.size > 1 ? 's' : ''}`
            : 'Sélection multiple'
          }
        </Button>
      </motion.div>

      {/* Bulk Action Bar */}
      {selectedTransactionIds.size > 0 && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            <span className="font-medium text-sm">
              {selectedTransactionIds.size} transaction{selectedTransactionIds.size > 1 ? 's' : ''} sélectionnée{selectedTransactionIds.size > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex-1" />

          {/* Bulk category selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2" disabled={bulkCategorizing}>
                {bulkCategorizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Tag className="w-4 h-4" />
                )}
                Catégoriser
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
              <DropdownMenuItem
                onClick={() => bulkUpdateCategory(null)}
                className="text-muted-foreground"
              >
                Retirer la catégorie
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              
              {incomeCategories.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Encaissements
                  </div>
                  {incomeCategories.map(cat => (
                    <DropdownMenuItem
                      key={cat.id}
                      onClick={() => bulkUpdateCategory(cat.id)}
                      className="flex items-center gap-2"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
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
                      onClick={() => bulkUpdateCategory(cat.id)}
                      className="flex items-center gap-2"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearSelection}
            className="gap-1"
          >
            <X className="w-4 h-4" />
            Annuler
          </Button>
        </motion.div>
      )}

      {/* Transactions List */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-2xl border border-border shadow-card"
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
                className={cn(
                  "p-5 hover:bg-muted/30 transition-colors group",
                  selectedTransactionIds.has(transaction.id) && "bg-primary/5"
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox for bulk selection */}
                  <Checkbox
                    checked={selectedTransactionIds.has(transaction.id)}
                    onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                    className="shrink-0"
                  />

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
                        <DropdownMenuContent align="start" side="top" sideOffset={5} collisionPadding={20} className="w-56 max-h-80 overflow-y-auto">
                          {/* Create new category option */}
                          <DropdownMenuItem
                            onClick={() => {
                              setPendingTransactionId(transaction.id);
                              setShowCategoryDialog(true);
                            }}
                            className="flex items-center gap-2 text-primary"
                          >
                            <PlusCircle className="w-4 h-4" />
                            Créer une catégorie
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />

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
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Dialog de suggestion d'automatisation */}
      <SuggestAutomationDialog
        open={showSuggestDialog}
        onOpenChange={setShowSuggestDialog}
        transaction={lastCategorizedTransaction}
        category={lastSelectedCategory}
        allTransactions={transactionsRef.current}
        onCreateRule={createRule}
      />

      {/* Dialog de création de catégorie */}
      <CategoryDialog
        open={showCategoryDialog}
        onOpenChange={(open) => {
          setShowCategoryDialog(open);
          if (!open) setPendingTransactionId(null);
        }}
        onSave={handleCreateCategory}
      />
    </div>
  );
}
