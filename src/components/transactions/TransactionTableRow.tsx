import { memo } from 'react';
import { cn } from '@/lib/utils';
import { 
  MoreHorizontal,
  PlusCircle,
  Wand2,
  XCircle,
  Sparkles,
  Scissors,
  Circle,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';

type Transaction = Tables<'transactions'>;

interface TransactionTableRowProps {
  transaction: Transaction;
  isSelected: boolean;
  highlightCategorize?: boolean;
  onToggleSelection: (id: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string | null) => void;
  onCreateCategory: (transactionId: string) => void;
  onOpenCategorizationModal?: (transaction: Transaction) => void;
  onSuggestAutomation?: (transaction: Transaction) => void;
  onSplitTransaction?: (transaction: Transaction) => void;
  getCategoryName: (categoryId: string | null) => string;
  getCategoryColor: (categoryId: string | null) => string | undefined;
  getBankAccountDisplay: (accountName: string | null) => string | null;
  incomeCategories: Category[];
  expenseCategories: Category[];
  formatAmount: (amount: number) => string;
  formatDate: (date: string) => string;
}

export const TransactionTableRow = memo(function TransactionTableRow({
  transaction,
  isSelected,
  highlightCategorize,
  onToggleSelection,
  onUpdateCategory,
  onCreateCategory,
  onOpenCategorizationModal,
  onSuggestAutomation,
  onSplitTransaction,
  getCategoryName,
  getCategoryColor,
  getBankAccountDisplay,
  incomeCategories,
  expenseCategories,
  formatAmount,
  formatDate,
}: TransactionTableRowProps) {
  const isUncategorized = !transaction.category_id;

  const handleCategoryChange = (categoryId: string | null) => {
    onUpdateCategory(transaction.id, categoryId);
  };

  const handleCreateCategory = () => {
    onCreateCategory(transaction.id);
  };

  const bankDisplay = getBankAccountDisplay(transaction.bank_account_name);

  return (
    <div 
      className={cn(
        "grid grid-cols-[48px_120px_1fr_140px_220px_140px_48px] gap-2 px-4 py-3 border-b border-border items-center hover:bg-muted/30 transition-colors",
        isSelected && "bg-primary/5"
      )}
    >
      {/* Selection circle */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => onToggleSelection(transaction.id)}
          className={cn(
            "transition-all duration-150",
            isSelected 
              ? "text-primary" 
              : "text-muted-foreground/40 hover:text-muted-foreground"
          )}
        >
          {isSelected ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Date */}
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(transaction.date)}
      </div>

      {/* Description */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {transaction.source === 'split' && (
            <span className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              <Scissors className="w-3 h-3" />
              Split
            </span>
          )}
          <span className="font-medium text-foreground truncate min-w-0 flex-1" title={transaction.description}>
            {transaction.description}
          </span>
          {transaction.ai_confidence && (
            <div className="flex items-center gap-1 text-accent shrink-0">
              <Sparkles className="w-3 h-3" />
              <span className="text-xs">
                {Math.round(Number(transaction.ai_confidence) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bank Account */}
      <div className="min-w-0">
        <span className="text-sm text-muted-foreground truncate block">
          {bankDisplay || '—'}
        </span>
      </div>

      {/* Category: Always opens the AI categorization modal */}
      <div>
        {isUncategorized ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenCategorizationModal?.(transaction)}
            className={cn(
              "h-9 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold",
              highlightCategorize && "animate-pulse ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
          >
            <Tag className="w-4 h-4" />
            Catégoriser
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenCategorizationModal?.(transaction)}
            className="h-9 w-full justify-start gap-2 font-normal"
          >
            <div 
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: getCategoryColor(transaction.category_id) }}
            />
            <span className="truncate">{getCategoryName(transaction.category_id)}</span>
          </Button>
        )}
      </div>

      {/* Amount */}
      <div className="text-right">
        <span className={cn(
          "font-semibold tabular-nums",
          transaction.type === 'income' ? 'text-success' : 'text-foreground'
        )}>
          {transaction.type === 'income' ? '+' : '-'}{formatAmount(Number(transaction.amount))}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {transaction.category_id && (
              <>
                <DropdownMenuItem onClick={() => onUpdateCategory(transaction.id, null)}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Retirer la catégorie
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {onSplitTransaction && (
              <DropdownMenuItem onClick={() => onSplitTransaction(transaction)}>
                <Scissors className="w-4 h-4 mr-2" />
                Diviser en plusieurs
              </DropdownMenuItem>
            )}
            {onSuggestAutomation && (
              <DropdownMenuItem onClick={() => onSuggestAutomation(transaction)}>
                <Wand2 className="w-4 h-4 mr-2" />
                Créer une règle
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onCreateCategory(transaction.id)}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Nouvelle catégorie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
