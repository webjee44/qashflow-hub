import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useQueryClient } from '@tanstack/react-query';
import { logError } from '@/lib/logger';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';
import type { AutomationRule } from '@/hooks/useAutomationRules';
import { isMatchingActiveCategorizationRule } from '@/lib/automationRuleMatching';

type Transaction = Tables<'transactions'>;

interface UseTransactionHandlersParams {
  transactions: Transaction[];
  rules: AutomationRule[];
  categoryMap: Map<string, Category>;
  updateCategory: (args: { transactionId: string; categoryId: string | null }) => Promise<unknown>;
  bulkUpdateCategory: (args: { transactionIds: string[]; categoryId: string | null }) => Promise<unknown>;
  bulkSetIgnored: (args: { transactionIds: string[]; isIgnored: boolean }) => Promise<unknown>;
  splitTransaction: (args: { originalTransactionId: string; splits: { categoryId: string | null; amount: number }[] }) => Promise<unknown>;
  refetchTransactions: () => void;
  applyRuleToExistingTransactions?: (ruleId: string) => Promise<number>;
}

export function useTransactionHandlers({
  transactions,
  rules,
  categoryMap,
  updateCategory,
  bulkUpdateCategory,
  bulkSetIgnored,
  splitTransaction,
  refetchTransactions,
  applyRuleToExistingTransactions,
}: UseTransactionHandlersParams) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  // Dialog state
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [lastCategorizedTransaction, setLastCategorizedTransaction] = useState<Transaction | null>(null);
  const [lastSelectedCategory, setLastSelectedCategory] = useState<Category | null>(null);
  const [lastExistingRuleMatch, setLastExistingRuleMatch] = useState<AutomationRule | null>(null);
  const [pendingAutomationSuggestion, setPendingAutomationSuggestion] = useState<{
    transaction: Transaction;
    category: Category;
    existingRuleMatch: AutomationRule | null;
  } | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [showBulkCategorizeDialog, setShowBulkCategorizeDialog] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [transactionToSplit, setTransactionToSplit] = useState<Transaction | null>(null);
  const [showCategorizationModal, setShowCategorizationModal] = useState(false);
  const [transactionToCategorize, setTransactionToCategorize] = useState<Transaction | null>(null);

  // Pure mutation: applies a category. No UI side effect.
  const handleUpdateCategory = useCallback(async (transactionId: string, categoryId: string | null) => {
    try {
      await updateCategory({ transactionId, categoryId });
      toast({ title: 'Catégorie mise à jour', description: 'La transaction a été catégorisée avec succès' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour la catégorie', variant: 'destructive' });
    }
  }, [updateCategory, toast]);

  // Deterministic flow gate: open SuggestAutomationDialog ONLY after the
  // categorization modal is fully closed. Avoids two dialogs in the same tick.
  useEffect(() => {
    if (!showCategorizationModal && pendingAutomationSuggestion && !showSuggestDialog) {
      setLastCategorizedTransaction(pendingAutomationSuggestion.transaction);
      setLastSelectedCategory(pendingAutomationSuggestion.category);
      setLastExistingRuleMatch(pendingAutomationSuggestion.existingRuleMatch);
      setShowSuggestDialog(true);
      setPendingAutomationSuggestion(null);
    }
  }, [showCategorizationModal, pendingAutomationSuggestion, showSuggestDialog]);

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
    forecast_mode?: 'manual' | 'percent_of_revenue' | 'auto_vat'; forecast_percent?: number;
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

  // Deterministic categorization flow:
  // 1. Snapshot transaction & resolve category (cache or fetch)
  // 2. Apply mutation
  // 3. Compute existing rule match
  // 4. Stage pendingAutomationSuggestion + close categorization modal
  // 5. useEffect above opens SuggestAutomationDialog once modal is closed
  const handleCategorizationSelect = useCallback(async (categoryId: string) => {
    if (!transactionToCategorize) return;
    const transactionSnapshot = transactionToCategorize;

    // Resolve category (cache, then fetch fallback for inline-created)
    let category = categoryMap.get(categoryId) ?? null;
    if (!category) {
      try {
        const { data: fetched } = await supabase
          .from('categories')
          .select('*')
          .eq('id', categoryId)
          .single();
        if (fetched) category = fetched as Category;
      } catch (err) {
        logError('Error fetching category for suggestion:', err);
      }
    }

    try {
      await updateCategory({ transactionId: transactionSnapshot.id, categoryId });
      toast({ title: 'Catégorie mise à jour', description: 'La transaction a été catégorisée avec succès' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour la catégorie', variant: 'destructive' });
      setShowCategorizationModal(false);
      setTransactionToCategorize(null);
      return;
    }

    if (category && currentCompany) {
      const existingRuleMatch = rules.find(rule =>
        isMatchingActiveCategorizationRule(
          rule,
          {
            description: transactionSnapshot.description,
            amount: transactionSnapshot.amount,
            type: transactionSnapshot.type,
            bank_account_name: transactionSnapshot.bank_account_name,
          },
          categoryId,
        ),
      ) as AutomationRule | undefined;

      setPendingAutomationSuggestion({
        transaction: { ...transactionSnapshot, category_id: categoryId },
        category,
        existingRuleMatch: existingRuleMatch ?? null,
      });
    }

    setShowCategorizationModal(false);
    setTransactionToCategorize(null);
  }, [transactionToCategorize, categoryMap, updateCategory, toast, currentCompany, rules]);

  const handleApplyExistingRule = useCallback(async (ruleId: string) => {
    if (!applyRuleToExistingTransactions) return;
    try {
      const updated = await applyRuleToExistingTransactions(ruleId);
      toast({
        title: 'Règle appliquée',
        description: updated > 0
          ? `${updated} transaction${updated > 1 ? 's' : ''} catégorisée${updated > 1 ? 's' : ''}`
          : 'Aucune nouvelle transaction à catégoriser',
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      refetchTransactions();
    } catch (err) {
      logError('Error applying existing rule:', err);
      toast({ title: 'Erreur', description: "Impossible d'appliquer la règle", variant: 'destructive' });
    }
  }, [applyRuleToExistingTransactions, toast, queryClient, refetchTransactions]);


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
    lastExistingRuleMatch,
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
    handleApplyExistingRule,
  };
}
