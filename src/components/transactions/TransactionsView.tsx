import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tables } from '@/integrations/supabase/types';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useBankAccounts } from './hooks/useBankAccounts';
import { useTransactionFilters } from './hooks/useTransactionFilters';
import { useTransactionHandlers } from './hooks/useTransactionHandlers';
import { TransactionStatsBar } from './TransactionStatsBar';
import { TransactionTabsFilter } from './TransactionTabsFilter';
import { TransactionFiltersBar } from './TransactionFiltersBar';
import { TransactionBulkActions } from './TransactionBulkActions';
import { TransactionTable } from './TransactionTable';
import { TransactionDialogs } from './TransactionDialogs';

export function TransactionsView() {
  const { createRule } = useAutomationRules();
  const {
    transactions, isLoading,
    updateCategory, bulkUpdateCategory, bulkSetIgnored, splitTransaction,
    isBulkUpdating, isBulkIgnoring, isSplitting,
    refetch: refetchTransactions,
  } = useTransactions();
  const { categories } = useCategories();
  const { balance: bankBalance } = useBankBalance();
  const { accountToBankMap, uniqueBankNames, getBankAccountDisplay } = useBankAccounts();

  const filters = useTransactionFilters({ transactions, categories, accountToBankMap });

  const handlers = useTransactionHandlers({
    transactions,
    categoryMap: filters.categoryMap,
    updateCategory,
    bulkUpdateCategory,
    bulkSetIgnored,
    splitTransaction,
    refetchTransactions,
  });

  // Formatters
  const formatAmount = useCallback((amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Math.abs(amount));
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }, []);

  // Selected transactions for bulk dialog
  const selectedTransactionsForBulk = useMemo(
    () => filters.filteredTransactions.filter(t => handlers.selectedTransactionIds.has(t.id)),
    [filters.filteredTransactions, handlers.selectedTransactionIds]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact header: title + stats + actions on one line */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            {filters.filteredTransactions.length.toLocaleString('fr-FR')} opération{filters.filteredTransactions.length > 1 ? 's' : ''}
          </span>
          <span className="text-sm text-muted-foreground">•</span>
          <span className={cn("text-sm font-semibold tabular-nums", bankBalance >= 0 ? "text-success" : "text-destructive")}>
            {formatAmount(bankBalance)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlers.applyAutomationRules}
            disabled={handlers.applyingRules}
            variant="outline"
            size="sm"
            className="gap-2"
            title="Appliquer les règles d'automatisation"
          >
            {handlers.applyingRules ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Appliquer les règles
          </Button>
        </div>
      </motion.div>

      <TransactionTabsFilter
        tabFilter={filters.tabFilter}
        onTabChange={filters.setTabFilter}
        tabCounts={filters.tabCounts}
      />

      <TransactionFiltersBar
        searchQuery={filters.searchQuery}
        onSearchChange={filters.setSearchQuery}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onDateFromChange={filters.setDateFrom}
        onDateToChange={filters.setDateTo}
        selectedCategoryFilter={filters.selectedCategoryFilter}
        onCategoryFilterChange={filters.setSelectedCategoryFilter}
        bankFilter={filters.bankFilter}
        onBankFilterChange={filters.setBankFilter}
        sortOption={filters.sortOption}
        onSortChange={filters.setSortOption}
        incomeCategories={filters.incomeCategories}
        expenseCategories={filters.expenseCategories}
        uniqueBankNames={uniqueBankNames}
      />

      <TransactionBulkActions
        selectedCount={handlers.selectedTransactionIds.size}
        tabFilter={filters.tabFilter}
        isBulkUpdating={isBulkUpdating}
        isBulkIgnoring={isBulkIgnoring}
        onCategorize={() => handlers.setShowBulkCategorizeDialog(true)}
        onIgnore={handlers.handleBulkIgnore}
        onClear={handlers.clearSelection}
      />

      <TransactionTable
        transactions={filters.filteredTransactions}
        selectedTransactionIds={handlers.selectedTransactionIds}
        onToggleSelection={handlers.toggleTransactionSelection}
        onSelectAll={handlers.selectAllVisible}
        onClearSelection={handlers.clearSelection}
        onUpdateCategory={handlers.handleUpdateCategory}
        onCreateCategory={handlers.onCreateCategoryForTransaction}
        onOpenCategorizationModal={handlers.handleOpenCategorizationModal}
        onSplitTransaction={handlers.handleOpenSplitDialog}
        getCategoryName={filters.getCategoryName}
        getCategoryColor={filters.getCategoryColor}
        getBankAccountDisplay={getBankAccountDisplay}
        incomeCategories={filters.incomeCategories}
        expenseCategories={filters.expenseCategories}
        formatAmount={formatAmount}
        formatDate={formatDate}
      />

      <p className="text-sm text-muted-foreground text-center">
        {filters.filteredTransactions.length} transaction{filters.filteredTransactions.length > 1 ? 's' : ''} affichée{filters.filteredTransactions.length > 1 ? 's' : ''}
      </p>

      <TransactionDialogs
        showSuggestDialog={handlers.showSuggestDialog}
        onShowSuggestDialogChange={handlers.setShowSuggestDialog}
        lastCategorizedTransaction={handlers.lastCategorizedTransaction}
        lastSelectedCategory={handlers.lastSelectedCategory as Tables<'categories'> | null}
        allTransactions={transactions}
        onCreateRule={async (rule) => {
          const result = await createRule(rule);
          if (result) refetchTransactions();
          return result;
        }}
        showCategoryDialog={handlers.showCategoryDialog}
        onShowCategoryDialogChange={handlers.setShowCategoryDialog}
        onSaveCategory={handlers.handleCreateCategory}
        onCategoryDialogClose={() => handlers.setPendingTransactionId(null)}
        showBulkCategorizeDialog={handlers.showBulkCategorizeDialog}
        onShowBulkCategorizeDialogChange={handlers.setShowBulkCategorizeDialog}
        selectedTransactions={selectedTransactionsForBulk}
        categories={categories}
        onBulkCategorize={async (categoryId) => {
          await handlers.handleBulkUpdateCategory(categoryId);
          handlers.setSelectedTransactionIds(new Set());
        }}
        isBulkUpdating={isBulkUpdating}
        showSplitDialog={handlers.showSplitDialog}
        onShowSplitDialogChange={(open) => {
          handlers.setShowSplitDialog(open);
          if (!open) handlers.setTransactionToSplit(null);
        }}
        transactionToSplit={handlers.transactionToSplit}
        onSplit={handlers.handleSplitTransaction}
        isSplitting={isSplitting}
        incomeCategories={filters.incomeCategories}
        expenseCategories={filters.expenseCategories}
        showCategorizationModal={handlers.showCategorizationModal}
        onShowCategorizationModalChange={(open) => {
          handlers.setShowCategorizationModal(open);
          if (!open) handlers.setTransactionToCategorize(null);
        }}
        transactionToCategorize={handlers.transactionToCategorize}
        onCategorizationSelect={handlers.handleCategorizationSelect}
        onRemoveCategory={() => {
          if (handlers.transactionToCategorize) {
            handlers.setShowCategorizationModal(false);
            handlers.handleUpdateCategory(handlers.transactionToCategorize.id, null);
            handlers.setTransactionToCategorize(null);
          }
        }}
        onCreateCategoryFromModal={() => {
          handlers.setShowCategorizationModal(false);
          if (handlers.transactionToCategorize) {
            handlers.onCreateCategoryForTransaction(handlers.transactionToCategorize.id);
          }
        }}
        onInlineCreateCategory={handlers.handleCreateCategory}
      />
    </div>
  );
}
