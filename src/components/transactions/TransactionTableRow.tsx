import { memo } from 'react';
import { cn } from '@/lib/utils';
import { 
  MoreHorizontal,
  PlusCircle,
  Wand2,
  XCircle,
  Sparkles,
  Scissors,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  onToggleSelection: (id: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string | null) => void;
  onCreateCategory: (transactionId: string) => void;
  onSuggestAutomation?: (transaction: Transaction) => void;
  onSplitTransaction?: (transaction: Transaction) => void;
  getCategoryName: (categoryId: string | null) => string;
  getCategoryColor: (categoryId: string | null) => string | undefined;
  incomeCategories: Category[];
  expenseCategories: Category[];
  formatAmount: (amount: number) => string;
  formatDate: (date: string) => string;
}

export const TransactionTableRow = memo(function TransactionTableRow({
  transaction,
  isSelected,
  onToggleSelection,
  onUpdateCategory,
  onCreateCategory,
  onSuggestAutomation,
  onSplitTransaction,
  getCategoryName,
  getCategoryColor,
  incomeCategories,
  expenseCategories,
  formatAmount,
  formatDate,
}: TransactionTableRowProps) {
  const categoryColor = getCategoryColor(transaction.category_id);
  const isUncategorized = !transaction.category_id;

  const handleCategoryChange = (value: string) => {
    if (value === 'create-new') {
      onCreateCategory(transaction.id);
    } else if (value === 'uncategorized') {
      onUpdateCategory(transaction.id, null);
    } else {
      onUpdateCategory(transaction.id, value);
    }
  };

  return (
    <div 
      className={cn(
        "grid grid-cols-[48px_120px_1fr_220px_140px_48px] gap-2 px-4 py-3 border-b border-border items-center hover:bg-muted/30 transition-colors",
        isSelected && "bg-primary/5"
      )}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(transaction.id)}
        />
      </div>

      {/* Date */}
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(transaction.date)}
      </div>

      {/* Description */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">
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

      {/* Category Select */}
      <div>
        <Select
          value={transaction.category_id || 'uncategorized'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger 
            className={cn(
              "w-full h-9",
              isUncategorized && "bg-warning/20 border-warning text-warning dark:bg-warning/10"
            )}
          >
            <SelectValue>
              {isUncategorized ? (
                <span>Sélect. catégorie</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: categoryColor }}
                  />
                  <span className="truncate">{getCategoryName(transaction.category_id)}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="create-new" className="text-primary">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                <span>Créer une catégorie</span>
              </div>
            </SelectItem>
            
            {transaction.category_id && (
              <>
                <SelectSeparator />
                <SelectItem value="uncategorized" className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>Retirer la catégorie</span>
                  </div>
                </SelectItem>
              </>
            )}

            {incomeCategories.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Encaissements</SelectLabel>
                  {incomeCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}

            {expenseCategories.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Décaissements</SelectLabel>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
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
