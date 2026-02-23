import { memo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';
import { TransactionTableRow } from './TransactionTableRow';

type Transaction = Tables<'transactions'>;

interface TransactionTableProps {
  transactions: Transaction[];
  selectedTransactionIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onUpdateCategory: (transactionId: string, categoryId: string | null) => void;
  onCreateCategory: (transactionId: string) => void;
  onOpenCategorizationModal: (transaction: Transaction) => void;
  onSuggestAutomation?: (transaction: Transaction) => void;
  onSplitTransaction: (transaction: Transaction) => void;
  getCategoryName: (categoryId: string | null) => string;
  getCategoryColor: (categoryId: string | null) => string | undefined;
  getBankAccountDisplay: (accountName: string | null) => string | null;
  incomeCategories: Category[];
  expenseCategories: Category[];
  formatAmount: (amount: number) => string;
  formatDate: (date: string) => string;
}

export const TransactionTable = memo(function TransactionTable({
  transactions,
  selectedTransactionIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onUpdateCategory,
  onCreateCategory,
  onOpenCategorizationModal,
  onSplitTransaction,
  getCategoryName,
  getCategoryColor,
  getBankAccountDisplay,
  incomeCategories,
  expenseCategories,
  formatAmount,
  formatDate,
}: TransactionTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  });

  const allSelected = selectedTransactionIds.size === transactions.length && transactions.length > 0;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
    >
      {transactions.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-muted-foreground">Aucune transaction trouvée</p>
          <p className="text-sm text-muted-foreground mt-2">Synchronisez votre compte bancaire pour importer vos transactions</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[48px_120px_1fr_140px_220px_140px_48px] gap-2 px-4 py-3 border-b border-border bg-muted/50 text-sm font-medium text-muted-foreground sticky top-0 z-10">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => {
                  if (checked) onSelectAll(transactions.map(t => t.id));
                  else onClearSelection();
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

          <div ref={parentRef} className="max-h-[600px] overflow-auto">
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const transaction = transactions[virtualRow.index];
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
                      onToggleSelection={onToggleSelection}
                      onUpdateCategory={onUpdateCategory}
                      onCreateCategory={onCreateCategory}
                      onOpenCategorizationModal={onOpenCategorizationModal}
                      onSplitTransaction={onSplitTransaction}
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
  );
});
