import { useMemo, useState, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { logError } from '@/lib/logger';
import { 
  Wand2,
  Search,
  Loader2,
  Tag,
  CheckSquare,
  Square,
  X
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { useCompany } from '@/hooks/useCompany';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { useCategories, Category } from '@/hooks/useCategories';
import { useTransactions, sortTransactions, filterTransactions, SortOption } from '@/hooks/useTransactions';
import { useBankBalance } from '@/hooks/useBankBalance';
import { SuggestAutomationDialog } from './SuggestAutomationDialog';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { TransactionRow } from './TransactionRow';
import { SortDropdown } from './SortDropdown';
import { BulkCategorizeDialog } from './BulkCategorizeDialog';

type Transaction = Tables<'transactions'>;

export function TransactionsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [lastCategorizedTransaction, setLastCategorizedTransaction] = useState<Transaction | null>(null);
  const [lastSelectedCategory, setLastSelectedCategory] = useState<Category | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [categorizing, setCategorizing] = useState(false);
  const [showBulkCategorizeDialog, setShowBulkCategorizeDialog] = useState(false);
  
  const parentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { createRule } = useAutomationRules();
  
  // Use React Query hooks
  const { 
    transactions, 
    isLoading, 
    updateCategory, 
    bulkUpdateCategory,
    isBulkUpdating,
    refetch: refetchTransactions
  } = useTransactions();
  
  const { categories } = useCategories();
  const { balance: bankBalance } = useBankBalance();

  // Memoized category lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const getCategoryName = useCallback((categoryId: string | null) => {
    if (!categoryId) return 'Non catégorisé';
    return categoryMap.get(categoryId)?.name || 'Non catégorisé';
  }, [categoryMap]);

  const getCategoryColor = useCallback((categoryId: string | null) => {
    if (!categoryId) return undefined;
    return categoryMap.get(categoryId)?.color;
  }, [categoryMap]);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    const filtered = filterTransactions(transactions, {
      searchQuery,
      categoryFilter: selectedCategoryFilter,
      getCategoryName,
    });
    return sortTransactions(filtered, sortOption);
  }, [transactions, searchQuery, selectedCategoryFilter, sortOption, getCategoryName]);

  // Virtualizer for performance
  const virtualizer = useVirtualizer({
    count: filteredTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88, // Approximate row height
    overscan: 5,
  });

  // Category groupings
  const incomeCategories = useMemo(() => 
    categories.filter(c => c.type === 'income'), [categories]);
  const expenseCategories = useMemo(() => 
    categories.filter(c => c.type === 'expense'), [categories]);

  // Stats
  const { totalIncome, totalExpense, uncategorizedCount } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let uncategorized = 0;

    for (const t of filteredTransactions) {
      const amount = Number(t.amount);
      if (t.type === 'income') income += amount;
      else expense += Math.abs(amount);
      if (!t.category_id) uncategorized++;
    }

    return { totalIncome: income, totalExpense: expense, uncategorizedCount: uncategorized };
  }, [filteredTransactions]);

  // Formatters
  const formatAmount = useCallback((amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount));
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }, []);

  // Handlers
  const handleUpdateCategory = useCallback(async (transactionId: string, categoryId: string | null) => {
    const transaction = transactions.find(t => t.id === transactionId);
    const previousCategoryId = transaction?.category_id;

    try {
      await updateCategory({ transactionId, categoryId });
      
      toast({
        title: 'Catégorie mise à jour',
        description: 'La transaction a été catégorisée avec succès',
      });

      // Suggest automation if assigning a new category
      if (categoryId && !previousCategoryId && transaction) {
        const category = categoryMap.get(categoryId);
        if (category) {
          setLastCategorizedTransaction({ ...transaction, category_id: categoryId });
          setLastSelectedCategory(category);
          setShowSuggestDialog(true);
        }
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la catégorie',
        variant: 'destructive',
      });
    }
  }, [transactions, updateCategory, categoryMap, toast]);

  const handleBulkUpdateCategory = useCallback(async (categoryId: string | null) => {
    if (selectedTransactionIds.size === 0) return;

    try {
      await bulkUpdateCategory({ 
        transactionIds: Array.from(selectedTransactionIds), 
        categoryId 
      });
      
      toast({
        title: 'Catégories mises à jour',
        description: `${selectedTransactionIds.size} transaction(s) catégorisée(s)`,
      });
      
      setSelectedTransactionIds(new Set());
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour les catégories',
        variant: 'destructive',
      });
    }
  }, [selectedTransactionIds, bulkUpdateCategory, toast]);

  const categorizeWithAI = useCallback(async () => {
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
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          transactionIds: uncategorizedIds,
          companyId: currentCompany?.id,
        },
      });

      if (error) {
        logError('AI categorization error:', error);
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
        refetchTransactions();
      }
    } catch (err) {
      logError('AI error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de catégoriser les transactions',
        variant: 'destructive',
      });
    } finally {
      setCategorizing(false);
    }
  }, [transactions, currentCompany, toast, refetchTransactions]);

  const toggleTransactionSelection = useCallback((transactionId: string) => {
    setSelectedTransactionIds(prev => {
      const next = new Set(prev);
      if (next.has(transactionId)) next.delete(transactionId);
      else next.add(transactionId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedTransactionIds(new Set(filteredTransactions.map(t => t.id)));
  }, [filteredTransactions]);

  const clearSelection = useCallback(() => {
    setSelectedTransactionIds(new Set());
  }, []);

  const handleCreateCategory = useCallback(async (data: {
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
      logError('Error creating category:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la catégorie',
        variant: 'destructive',
      });
      return null;
    }

    toast({
      title: 'Catégorie créée',
      description: `La catégorie "${data.name}" a été créée`,
    });

    if (pendingTransactionId) {
      await handleUpdateCategory(pendingTransactionId, newCategory.id);
      setPendingTransactionId(null);
    }

    return newCategory;
  }, [currentCompany, pendingTransactionId, handleUpdateCategory, toast]);

  const onCreateCategoryForTransaction = useCallback((transactionId: string) => {
    setPendingTransactionId(transactionId);
    setShowCategoryDialog(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm font-medium">
            {filteredTransactions.length.toLocaleString('fr-FR')} résultat{filteredTransactions.length > 1 ? 's' : ''}
          </Badge>
        </div>
        <Button 
          onClick={categorizeWithAI} 
          disabled={categorizing}
          variant="outline"
          className="gap-2"
        >
          {categorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Catégoriser avec l'IA
        </Button>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-4"
      >
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Transactions</p>
          <p className="text-2xl font-bold text-foreground">{filteredTransactions.length.toLocaleString('fr-FR')}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Solde bancaire</p>
          <p className={cn(
            "text-2xl font-bold",
            bankBalance >= 0 ? "text-success" : "text-destructive"
          )}>
            {formatAmount(bankBalance)}
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-3 flex-wrap"
      >
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une transaction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <SortDropdown value={sortOption} onChange={setSortOption} />

        <Button
          variant={selectedCategoryFilter === 'Non catégorisé' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategoryFilter(prev => prev === 'Non catégorisé' ? null : 'Non catégorisé')}
          className="relative"
        >
          Non catégorisé
          {uncategorizedCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold px-1.5">
              {uncategorizedCount}
            </span>
          )}
        </Button>

        <Button
          variant={selectedTransactionIds.size > 0 ? 'default' : 'outline'}
          size="sm"
          onClick={() => selectedTransactionIds.size > 0 ? clearSelection() : selectAllVisible()}
          className="gap-2"
        >
          {selectedTransactionIds.size > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
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
          className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            <span className="font-medium text-sm">
              {selectedTransactionIds.size} transaction{selectedTransactionIds.size > 1 ? 's' : ''} sélectionnée{selectedTransactionIds.size > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex-1" />

          <Button 
            size="sm" 
            className="gap-2" 
            disabled={isBulkUpdating}
            onClick={() => setShowBulkCategorizeDialog(true)}
          >
            {isBulkUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
            Catégoriser
          </Button>

          <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1">
            <X className="w-4 h-4" />
            Annuler
          </Button>
        </motion.div>
      )}

      {/* Virtualized Transactions List */}
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
              Synchronisez votre compte bancaire pour importer vos transactions
            </p>
          </div>
        ) : (
          <div 
            ref={parentRef} 
            className="max-h-[600px] overflow-auto scrollbar-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const transaction = filteredTransactions[virtualRow.index];
                return (
                  <div
                    key={transaction.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="border-b border-border last:border-b-0"
                  >
                    <TransactionRow
                      transaction={transaction}
                      isSelected={selectedTransactionIds.has(transaction.id)}
                      onToggleSelection={toggleTransactionSelection}
                      onUpdateCategory={handleUpdateCategory}
                      onCreateCategory={onCreateCategoryForTransaction}
                      getCategoryName={getCategoryName}
                      getCategoryColor={getCategoryColor}
                      incomeCategories={incomeCategories}
                      expenseCategories={expenseCategories}
                      formatAmount={formatAmount}
                      formatDate={formatDate}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Result count */}
      <p className="text-sm text-muted-foreground text-center">
        {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? 's' : ''} affichée{filteredTransactions.length > 1 ? 's' : ''}
      </p>

      {/* Dialogs */}
      <SuggestAutomationDialog
        open={showSuggestDialog}
        onOpenChange={setShowSuggestDialog}
        transaction={lastCategorizedTransaction}
        category={lastSelectedCategory as Tables<'categories'> | null}
        allTransactions={transactions}
        onCreateRule={createRule}
      />

      <CategoryDialog
        open={showCategoryDialog}
        onOpenChange={(open) => {
          setShowCategoryDialog(open);
          if (!open) setPendingTransactionId(null);
        }}
        onSave={handleCreateCategory}
      />

      <BulkCategorizeDialog
        open={showBulkCategorizeDialog}
        onOpenChange={setShowBulkCategorizeDialog}
        selectedTransactions={filteredTransactions.filter(t => selectedTransactionIds.has(t.id))}
        allTransactions={transactions}
        categories={categories}
        onCategorize={async (categoryId) => {
          await handleBulkUpdateCategory(categoryId);
          setSelectedTransactionIds(new Set());
        }}
        onCreateRule={createRule}
        isLoading={isBulkUpdating}
      />
    </div>
  );
}
