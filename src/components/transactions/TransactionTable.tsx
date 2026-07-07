import { memo, useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';
import { TransactionTableRow } from './TransactionTableRow';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortOption } from '@/hooks/useTransactions';
import type { ConflictedTransactionInfo } from '@/features/automations/api/conflictedTransactionsApi';

type Transaction = Tables<'transactions'>;

type SortKey = 'date' | 'name' | 'amount';

const SORT_MAP: Record<SortKey, { asc: SortOption; desc: SortOption }> = {
  date: { asc: 'date_asc', desc: 'date_desc' },
  name: { asc: 'name_asc', desc: 'name_desc' },
  amount: { asc: 'amount_asc', desc: 'amount_desc' },
};

function getSortState(option: SortOption, key: SortKey): 'asc' | 'desc' | null {
  if (option === SORT_MAP[key].asc) return 'asc';
  if (option === SORT_MAP[key].desc) return 'desc';
  return null;
}

interface TransactionTableProps {
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
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
  conflictMap?: Map<string, ConflictedTransactionInfo>;
}

export const TransactionTable = memo(function TransactionTable({
  sortOption,
  onSortChange,
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
  conflictMap,
}: TransactionTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const handleSort = (key: SortKey) => {
    const current = getSortState(sortOption, key);
    // Default direction by column: date desc, name asc, amount desc
    const defaultDir: 'asc' | 'desc' = key === 'name' ? 'asc' : 'desc';
    if (current === null) {
      onSortChange(SORT_MAP[key][defaultDir]);
    } else {
      onSortChange(SORT_MAP[key][current === 'asc' ? 'desc' : 'asc']);
    }
  };

  const SortIcon = ({ state }: { state: 'asc' | 'desc' | null }) => {
    if (state === 'asc') return <ArrowUp className="w-3.5 h-3.5" />;
    if (state === 'desc') return <ArrowDown className="w-3.5 h-3.5" />;
    return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
  };

  // Highlight first uncategorized transaction's "Catégoriser" button after onboarding
  const [highlightFirstId, setHighlightFirstId] = useState<string | null>(null);
  useEffect(() => {
    if (localStorage.getItem('highlight-first-categorize') === 'true' && transactions.length > 0) {
      const first = transactions.find(t => !t.category_id);
      if (first) {
        setHighlightFirstId(first.id);
        localStorage.removeItem('highlight-first-categorize');
        // Stop pulsing after 6 seconds
        const timer = setTimeout(() => setHighlightFirstId(null), 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [transactions]);

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
            <button
              type="button"
              onClick={() => handleSort('date')}
              className={cn(
                'flex items-center gap-1.5 text-left hover:text-foreground transition-colors',
                getSortState(sortOption, 'date') !== null && 'text-foreground'
              )}
            >
              Date
              <SortIcon state={getSortState(sortOption, 'date')} />
            </button>
            <button
              type="button"
              onClick={() => handleSort('name')}
              className={cn(
                'flex items-center gap-1.5 text-left hover:text-foreground transition-colors',
                getSortState(sortOption, 'name') !== null && 'text-foreground'
              )}
            >
              Libellé
              <SortIcon state={getSortState(sortOption, 'name')} />
            </button>
            <div>Banque</div>
            <div>Catégorie</div>
            <button
              type="button"
              onClick={() => handleSort('amount')}
              className={cn(
                'flex items-center justify-end gap-1.5 hover:text-foreground transition-colors',
                getSortState(sortOption, 'amount') !== null && 'text-foreground'
              )}
            >
              Montant TTC
              <SortIcon state={getSortState(sortOption, 'amount')} />
            </button>
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
                      highlightCategorize={transaction.id === highlightFirstId}
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
                      conflictInfo={conflictMap?.get(transaction.id)}
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
