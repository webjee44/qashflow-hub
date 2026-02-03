import { useMemo, useState, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { logError } from '@/lib/logger';
import { 
  Search,
  Loader2,
  Tag,
  CheckSquare,
  Square,
  X,
  RefreshCw,
  List,
  CheckCircle2,
  CircleDashed
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { useCompany } from '@/hooks/useCompany';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { useCategories, Category } from '@/hooks/useCategories';
import { useTransactions, sortTransactions, filterTransactions, SortOption } from '@/hooks/useTransactions';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useQuery } from '@tanstack/react-query';
import { SuggestAutomationDialog } from './SuggestAutomationDialog';
import { CategorizationModal } from './CategorizationModal';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { TransactionTableRow } from './TransactionTableRow';
import { SortDropdown } from './SortDropdown';
import { BankFilterDropdown } from './BankFilterDropdown';
import { BulkCategorizeDialog } from './BulkCategorizeDialog';
import { SplitTransactionDialog } from './SplitTransactionDialog';

type Transaction = Tables<'transactions'>;

type TabFilter = 'all' | 'categorized' | 'uncategorized';

export function TransactionsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [bankFilter, setBankFilter] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [lastCategorizedTransaction, setLastCategorizedTransaction] = useState<Transaction | null>(null);
  const [lastSelectedCategory, setLastSelectedCategory] = useState<Category | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [showBulkCategorizeDialog, setShowBulkCategorizeDialog] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [transactionToSplit, setTransactionToSplit] = useState<Transaction | null>(null);
  const [showCategorizationModal, setShowCategorizationModal] = useState(false);
  const [transactionToCategorize, setTransactionToCategorize] = useState<Transaction | null>(null);

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
    splitTransaction,
    isBulkUpdating,
    isSplitting,
    refetch: refetchTransactions
  } = useTransactions();
  
  const { categories } = useCategories();
  const { balance: bankBalance } = useBankBalance();

  // Fetch ALL bank accounts to get the bank name mapping (transactions may come from any connected account)
  const { data: bridgeAccounts = [] } = useQuery({
    queryKey: ['bridge-accounts-all'],
    queryFn: async () => {
      // Fetch all bridge accounts to get bank name for any transaction
      const { data, error } = await supabase
        .from('bridge_accounts')
        .select('name, bank_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create a mapping from account name to bank name only (e.g., "Qonto" instead of "Qonto - E-fumeur")
  const bankAccountDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    bridgeAccounts.forEach(acc => {
      if (acc.name) {
        // Only show bank name, not the full account name
        const bankName = acc.bank_name && acc.bank_name.toLowerCase() !== 'bridge' ? acc.bank_name : null;
        map.set(acc.name, bankName || acc.name);
      }
    });
    return map;
  }, [bridgeAccounts]);

  // Get unique bank names for the filter dropdown
  const uniqueBankNames = useMemo(() => {
    const bankSet = new Set<string>();
    bridgeAccounts.forEach(acc => {
      const bankName = acc.bank_name && acc.bank_name.toLowerCase() !== 'bridge' ? acc.bank_name : acc.name;
      if (bankName) bankSet.add(bankName);
    });
    return Array.from(bankSet).sort();
  }, [bridgeAccounts]);

  const getBankAccountDisplay = useCallback((accountName: string | null) => {
    if (!accountName) return null;
    return bankAccountDisplayMap.get(accountName) || accountName;
  }, [bankAccountDisplayMap]);

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
    // Apply tab filter first
    let baseFiltered = transactions;
    if (tabFilter === 'categorized') {
      baseFiltered = transactions.filter(t => t.category_id !== null);
    } else if (tabFilter === 'uncategorized') {
      baseFiltered = transactions.filter(t => t.category_id === null);
    }
    
    // Apply bank filter
    if (bankFilter) {
      baseFiltered = baseFiltered.filter(t => {
        const bankName = getBankAccountDisplay(t.bank_account_name);
        return bankName === bankFilter;
      });
    }
    
    const filtered = filterTransactions(baseFiltered, {
      searchQuery,
      categoryFilter: selectedCategoryFilter,
      getCategoryName,
    });
    return sortTransactions(filtered, sortOption);
  }, [transactions, tabFilter, bankFilter, searchQuery, selectedCategoryFilter, sortOption, getCategoryName, getBankAccountDisplay]);

  // Tab counts (from all transactions, not filtered by tab)
  const tabCounts = useMemo(() => {
    let categorized = 0;
    let uncategorized = 0;
    for (const t of transactions) {
      if (t.category_id) categorized++;
      else uncategorized++;
    }
    return { 
      all: transactions.length,
      categorized, 
      uncategorized 
    };
  }, [transactions]);

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

  const applyAutomationRules = useCallback(async () => {
    setApplyingRules(true);
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

      const { data, error } = await supabase.functions.invoke('apply-all-automation-rules', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { company_id: currentCompany?.id },
      });

      if (error) {
        logError('Apply automation rules error:', error);
        toast({
          title: 'Erreur',
          description: error.message || 'Une erreur est survenue',
          variant: 'destructive',
        });
      } else {
        if (data.updated > 0) {
          toast({
            title: 'Règles appliquées',
            description: `${data.updated} transaction${data.updated > 1 ? 's' : ''} catégorisée${data.updated > 1 ? 's' : ''}`,
          });
          refetchTransactions();
        } else {
          toast({
            title: 'Aucune correspondance',
            description: 'Aucune transaction non catégorisée ne correspond aux règles actives',
          });
        }
      }
    } catch (err) {
      logError('Apply rules error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'appliquer les règles',
        variant: 'destructive',
      });
    } finally {
      setApplyingRules(false);
    }
  }, [currentCompany, toast, refetchTransactions]);

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

  const handleOpenSplitDialog = useCallback((transaction: Transaction) => {
    setTransactionToSplit(transaction);
    setShowSplitDialog(true);
  }, []);

  const handleOpenCategorizationModal = useCallback((transaction: Transaction) => {
    setTransactionToCategorize(transaction);
    setShowCategorizationModal(true);
  }, []);

  const handleCategorizationSelect = useCallback(async (categoryId: string) => {
    if (!transactionToCategorize) return;
    
    await handleUpdateCategory(transactionToCategorize.id, categoryId);
    setShowCategorizationModal(false);
    setTransactionToCategorize(null);
  }, [transactionToCategorize, handleUpdateCategory]);

  const handleSplitTransaction = useCallback(async (splits: { categoryId: string | null; amount: number }[]) => {
    if (!transactionToSplit) return;

    try {
      await splitTransaction({
        originalTransactionId: transactionToSplit.id,
        splits,
      });
      
      toast({
        title: 'Transaction divisée',
        description: `La transaction a été divisée en ${splits.length} sous-transactions`,
      });
      
      setShowSplitDialog(false);
      setTransactionToSplit(null);
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de diviser la transaction',
        variant: 'destructive',
      });
    }
  }, [transactionToSplit, splitTransaction, toast]);

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
        <div className="flex items-center gap-2">
          <Button 
            onClick={applyAutomationRules} 
            disabled={applyingRules}
            variant="outline"
            className="gap-2"
            title="Appliquer les règles d'automatisation"
          >
            {applyingRules ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Appliquer les règles
          </Button>
        </div>
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

      {/* Tabs Filter */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={tabFilter} onValueChange={(v) => setTabFilter(v as TabFilter)}>
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-12 p-1 bg-muted/80">
            <TabsTrigger 
              value="all" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Tous les mouvements</span>
              <span className="sm:hidden">Tous</span>
              <Badge variant="outline" className="ml-1 text-xs bg-background/50">
                {tabCounts.all.toLocaleString('fr-FR')}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="categorized" 
              className="gap-2 data-[state=active]:bg-success data-[state=active]:text-success-foreground"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Catégorisé</span>
              <span className="sm:hidden">Catég.</span>
              <Badge variant="outline" className="ml-1 text-xs bg-background/50">
                {tabCounts.categorized.toLocaleString('fr-FR')}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="uncategorized" 
              className="gap-2 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground"
            >
              <CircleDashed className="w-4 h-4" />
              <span className="hidden sm:inline">Non catégorisé</span>
              <span className="sm:hidden">Non cat.</span>
              {tabCounts.uncategorized > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {tabCounts.uncategorized.toLocaleString('fr-FR')}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
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

        <BankFilterDropdown 
          value={bankFilter} 
          onChange={setBankFilter} 
          banks={uniqueBankNames} 
        />
        <SortDropdown value={sortOption} onChange={setSortOption} />
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

      {/* Table View */}
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
              Synchronisez votre compte bancaire pour importer vos transactions
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-[48px_120px_1fr_140px_220px_140px_48px] gap-2 px-4 py-3 border-b border-border bg-muted/50 text-sm font-medium text-muted-foreground sticky top-0 z-10">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={selectedTransactionIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) selectAllVisible();
                    else clearSelection();
                  }}
                />
              </div>
              <div>Date</div>
              <div>Libellé</div>
              <div>Banque</div>
              <div>Catégorie</div>
              <div className="text-right">Montant TTC</div>
              <div></div>
            </div>

            {/* Virtualized Rows */}
            <div 
              ref={parentRef} 
              className="max-h-[600px] overflow-auto"
            >
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
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
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TransactionTableRow
                        transaction={transaction}
                        isSelected={selectedTransactionIds.has(transaction.id)}
                        onToggleSelection={toggleTransactionSelection}
                        onUpdateCategory={handleUpdateCategory}
                        onCreateCategory={onCreateCategoryForTransaction}
                        onOpenCategorizationModal={handleOpenCategorizationModal}
                        onSplitTransaction={handleOpenSplitDialog}
                        getCategoryName={getCategoryName}
                        getCategoryColor={getCategoryColor}
                        getBankAccountDisplay={getBankAccountDisplay}
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
          </>
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

      <SplitTransactionDialog
        open={showSplitDialog}
        onOpenChange={(open) => {
          setShowSplitDialog(open);
          if (!open) setTransactionToSplit(null);
        }}
        transaction={transactionToSplit}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onSplit={handleSplitTransaction}
        isLoading={isSplitting}
      />

      <CategorizationModal
        open={showCategorizationModal}
        onOpenChange={(open) => {
          setShowCategorizationModal(open);
          if (!open) setTransactionToCategorize(null);
        }}
        transaction={transactionToCategorize}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onSelectCategory={handleCategorizationSelect}
        onCreateCategory={() => {
          setShowCategorizationModal(false);
          if (transactionToCategorize) {
            onCreateCategoryForTransaction(transactionToCategorize.id);
          }
        }}
      />
    </div>
  );
}
