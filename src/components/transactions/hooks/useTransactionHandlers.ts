import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useQueryClient } from '@tanstack/react-query';
import { logError } from '@/lib/logger';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';

type Transaction = Tables<'transactions'>;

interface UseTransactionHandlersParams {
  transactions: Transaction[];
  categoryMap: Map<string, Category>;
  updateCategory: (args: { transactionId: string; categoryId: string | null }) => Promise<unknown>;
  bulkUpdateCategory: (args: { transactionIds: string[]; categoryId: string | null }) => Promise<unknown>;
  bulkSetIgnored: (args: { transactionIds: string[]; isIgnored: boolean }) => Promise<unknown>;
  splitTransaction: (args: { originalTransactionId: string; splits: { categoryId: string | null; amount: number }[] }) => Promise<unknown>;
  refetchTransactions: () => void;
}

export function useTransactionHandlers({
  transactions,
  categoryMap,
  updateCategory,
  bulkUpdateCategory,
  bulkSetIgnored,
  splitTransaction,
  refetchTransactions,
}: UseTransactionHandlersParams) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  // Dialog state
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

  const handleUpdateCategory = useCallback(async (transactionId: string, categoryId: string | null) => {
    const transaction = transactions.find(t => t.id === transactionId);
    const previousCategoryId = transaction?.category_id;

    try {
      await updateCategory({ transactionId, categoryId });
      toast({ title: 'Catégorie mise à jour', description: 'La transaction a été catégorisée avec succès' });

      if (categoryId && !previousCategoryId && transaction) {
        let category = categoryMap.get(categoryId);
        // If category not yet in cache (e.g. just created inline), fetch it
        if (!category) {
          const { data: fetchedCat } = await supabase
            .from('categories')
            .select('*')
            .eq('id', categoryId)
            .single();
          if (fetchedCat) category = fetchedCat as Category;
        }
        if (category && currentCompany) {
          const { data: existingRules } = await supabase
            .from('automation_rules')
            .select('id')
            .eq('company_id', currentCompany.id)
            .eq('is_active', true)
            .ilike('condition_value', `%${transaction.description.substring(0, 10)}%`)
            .limit(1);

          if (!existingRules || existingRules.length === 0) {
            setLastCategorizedTransaction({ ...transaction, category_id: categoryId });
            setLastSelectedCategory(category);
            setShowSuggestDialog(true);
          }
        }
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour la catégorie', variant: 'destructive' });
    }
  }, [transactions, updateCategory, categoryMap, toast, currentCompany]);

  const handleBulkUpdateCategory = useCallback(async (categoryId: string | null) => {
    if (selectedTransactionIds.size === 0) return;
    try {
      await bulkUpdateCategory({ transactionIds: Array.from(selectedTransactionIds), categoryId });
      toast({ title: 'Catégories mises à jour', description: `${selectedTransactionIds.size} transaction(s) catégorisée(s)` });
      setSelectedTransactionIds(new Set());
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour les catégories', variant: 'destructive' });
    }
  }, [selectedTransactionIds, bulkUpdateCategory, toast]);

  const handleBulkIgnore = useCallback(async (isIgnored: boolean) => {
    if (selectedTransactionIds.size === 0) return;
    try {
      await bulkSetIgnored({ transactionIds: Array.from(selectedTransactionIds), isIgnored });
      toast({
        title: isIgnored ? 'Transactions ignorées' : 'Transactions restaurées',
        description: `${selectedTransactionIds.size} transaction(s) ${isIgnored ? 'ignorée(s)' : 'restaurée(s)'}`,
      });
      setSelectedTransactionIds(new Set());
    } catch {
      toast({ title: 'Erreur', description: `Impossible ${isIgnored ? "d'ignorer" : 'de restaurer'} les transactions`, variant: 'destructive' });
    }
  }, [selectedTransactionIds, bulkSetIgnored, toast]);

  const applyAutomationRules = useCallback(async () => {
    setApplyingRules(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Erreur', description: 'Vous devez être connecté', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('apply-all-automation-rules', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { company_id: currentCompany?.id },
      });
      if (error) {
        logError('Apply automation rules error:', error);
        toast({ title: 'Erreur', description: error.message || 'Une erreur est survenue', variant: 'destructive' });
      } else if (data.updated > 0) {
        toast({ title: 'Règles appliquées', description: `${data.updated} transaction${data.updated > 1 ? 's' : ''} catégorisée${data.updated > 1 ? 's' : ''}` });
        refetchTransactions();
      } else {
        toast({ title: 'Aucune correspondance', description: 'Aucune transaction non catégorisée ne correspond aux règles actives' });
      }
    } catch (err) {
      logError('Apply rules error:', err);
      toast({ title: 'Erreur', description: "Impossible d'appliquer les règles", variant: 'destructive' });
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

  const selectAllVisible = useCallback((visibleIds: string[]) => {
    setSelectedTransactionIds(new Set(visibleIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTransactionIds(new Set());
  }, []);

  const handleCreateCategory = useCallback(async (data: {
    name: string; color: string; icon: string; type: 'income' | 'expense';
    vat_rate?: number; parent_id?: string | null;
    forecast_mode?: 'manual' | 'percent_of_revenue'; forecast_percent?: number;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: newCategory, error } = await supabase
      .from('categories')
      .insert({
        name: data.name, color: data.color, icon: data.icon, type: data.type,
        user_id: user.id, company_id: currentCompany?.id || null,
        vat_rate: data.vat_rate ?? 0.20, parent_id: data.parent_id ?? null,
        forecast_mode: data.forecast_mode ?? 'manual', forecast_percent: data.forecast_percent ?? 0,
      })
      .select()
      .single();

    if (error) {
      logError('Error creating category:', error);
      toast({ title: 'Erreur', description: 'Impossible de créer la catégorie', variant: 'destructive' });
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ['categories'] });
    toast({ title: 'Catégorie créée', description: `La catégorie "${data.name}" a été créée` });

    if (pendingTransactionId) {
      await handleUpdateCategory(pendingTransactionId, newCategory.id);
      setPendingTransactionId(null);
    }

    return newCategory;
  }, [currentCompany, pendingTransactionId, handleUpdateCategory, toast, queryClient]);

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
    setShowCategorizationModal(false);
    setTransactionToCategorize(null);
    await new Promise(resolve => setTimeout(resolve, 150));
    await handleUpdateCategory(transactionToCategorize.id, categoryId);
  }, [transactionToCategorize, handleUpdateCategory]);

  const handleSplitTransaction = useCallback(async (splits: { categoryId: string | null; amount: number }[]) => {
    if (!transactionToSplit) return;
    try {
      await splitTransaction({ originalTransactionId: transactionToSplit.id, splits });
      toast({ title: 'Transaction divisée', description: `La transaction a été divisée en ${splits.length} sous-transactions` });
      setShowSplitDialog(false);
      setTransactionToSplit(null);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de diviser la transaction', variant: 'destructive' });
    }
  }, [transactionToSplit, splitTransaction, toast]);

  return {
    // Dialog state
    showSuggestDialog, setShowSuggestDialog,
    lastCategorizedTransaction, lastSelectedCategory,
    showCategoryDialog, setShowCategoryDialog,
    pendingTransactionId, setPendingTransactionId,
    selectedTransactionIds, setSelectedTransactionIds,
    showBulkCategorizeDialog, setShowBulkCategorizeDialog,
    applyingRules,
    showSplitDialog, setShowSplitDialog,
    transactionToSplit, setTransactionToSplit,
    showCategorizationModal, setShowCategorizationModal,
    transactionToCategorize, setTransactionToCategorize,
    // Handlers
    handleUpdateCategory,
    handleBulkUpdateCategory,
    handleBulkIgnore,
    applyAutomationRules,
    toggleTransactionSelection,
    selectAllVisible,
    clearSelection,
    handleCreateCategory,
    onCreateCategoryForTransaction,
    handleOpenSplitDialog,
    handleOpenCategorizationModal,
    handleCategorizationSelect,
    handleSplitTransaction,
  };
}
