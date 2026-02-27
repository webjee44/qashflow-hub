import { memo } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';
import { SuggestAutomationDialog } from './SuggestAutomationDialog';
import { CategorizationModal } from './CategorizationModal';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { BulkCategorizeDialog } from './BulkCategorizeDialog';
import { SplitTransactionDialog } from './SplitTransactionDialog';

type Transaction = Tables<'transactions'>;

interface TransactionDialogsProps {
  // Suggest automation
  showSuggestDialog: boolean;
  onShowSuggestDialogChange: (open: boolean) => void;
  lastCategorizedTransaction: Transaction | null;
  lastSelectedCategory: Tables<'categories'> | null;
  allTransactions: Transaction[];
  onCreateRule: (rule: any) => Promise<any>;

  // Category creation
  showCategoryDialog: boolean;
  onShowCategoryDialogChange: (open: boolean) => void;
  onSaveCategory: (data: any) => Promise<any>;
  onCategoryDialogClose: () => void;

  // Bulk categorize
  showBulkCategorizeDialog: boolean;
  onShowBulkCategorizeDialogChange: (open: boolean) => void;
  selectedTransactions: Transaction[];
  categories: Category[];
  onBulkCategorize: (categoryId: string | null) => Promise<void>;
  isBulkUpdating: boolean;

  // Split
  showSplitDialog: boolean;
  onShowSplitDialogChange: (open: boolean) => void;
  transactionToSplit: Transaction | null;
  onSplit: (splits: { categoryId: string | null; amount: number }[]) => Promise<void>;
  isSplitting: boolean;
  incomeCategories: Category[];
  expenseCategories: Category[];

  // Categorization modal
  showCategorizationModal: boolean;
  onShowCategorizationModalChange: (open: boolean) => void;
  transactionToCategorize: Transaction | null;
  onCategorizationSelect: (categoryId: string) => Promise<void>;
  onRemoveCategory: () => void;
  onCreateCategoryFromModal: () => void;
  onInlineCreateCategory?: (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    vat_rate: number;
  }) => Promise<any>;
}

export const TransactionDialogs = memo(function TransactionDialogs({
  showSuggestDialog, onShowSuggestDialogChange,
  lastCategorizedTransaction, lastSelectedCategory,
  allTransactions, onCreateRule,
  showCategoryDialog, onShowCategoryDialogChange, onSaveCategory, onCategoryDialogClose,
  showBulkCategorizeDialog, onShowBulkCategorizeDialogChange,
  selectedTransactions, categories, onBulkCategorize, isBulkUpdating,
  showSplitDialog, onShowSplitDialogChange,
  transactionToSplit, onSplit, isSplitting,
  incomeCategories, expenseCategories,
  showCategorizationModal, onShowCategorizationModalChange,
  transactionToCategorize, onCategorizationSelect,
  onRemoveCategory, onCreateCategoryFromModal, onInlineCreateCategory,
}: TransactionDialogsProps) {
  return (
    <>
      <SuggestAutomationDialog
        open={showSuggestDialog}
        onOpenChange={onShowSuggestDialogChange}
        transaction={lastCategorizedTransaction}
        category={lastSelectedCategory}
        allTransactions={allTransactions}
        onCreateRule={onCreateRule}
      />

      <CategoryDialog
        open={showCategoryDialog}
        onOpenChange={(open) => {
          onShowCategoryDialogChange(open);
          if (!open) onCategoryDialogClose();
        }}
        onSave={onSaveCategory}
      />

      <BulkCategorizeDialog
        open={showBulkCategorizeDialog}
        onOpenChange={onShowBulkCategorizeDialogChange}
        selectedTransactions={selectedTransactions}
        allTransactions={allTransactions}
        categories={categories}
        onCategorize={onBulkCategorize}
        onCreateRule={onCreateRule}
        isLoading={isBulkUpdating}
      />

      <SplitTransactionDialog
        open={showSplitDialog}
        onOpenChange={(open) => {
          onShowSplitDialogChange(open);
        }}
        transaction={transactionToSplit}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onSplit={onSplit}
        isLoading={isSplitting}
      />

      <CategorizationModal
        open={showCategorizationModal}
        onOpenChange={(open) => {
          onShowCategorizationModalChange(open);
        }}
        transaction={transactionToCategorize}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onSelectCategory={onCategorizationSelect}
        onRemoveCategory={onRemoveCategory}
        onCreateCategory={onCreateCategoryFromModal}
        onInlineCreateCategory={onInlineCreateCategory}
      />
    </>
  );
});
