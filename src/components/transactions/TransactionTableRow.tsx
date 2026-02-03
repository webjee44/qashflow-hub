import { memo } from 'react';
import { cn } from '@/lib/utils';
import { 
  MoreHorizontal,
  PlusCircle,
  Wand2,
  XCircle,
  Sparkles,
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
import { TableCell, TableRow } from '@/components/ui/table';
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
    <TableRow className={cn(isSelected && "bg-primary/5")}>
      {/* Checkbox */}
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(transaction.id)}
        />
      </TableCell>

      {/* Date */}
      <TableCell className="w-32 text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(transaction.date)}
      </TableCell>

      {/* Description */}
      <TableCell className="max-w-md">
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
      </TableCell>

      {/* Category Select */}
      <TableCell className="w-56">
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
      </TableCell>

      {/* Amount */}
      <TableCell className="w-36 text-right">
        <span className={cn(
          "font-semibold tabular-nums",
          transaction.type === 'income' ? 'text-success' : 'text-foreground'
        )}>
          {transaction.type === 'income' ? '+' : '-'}{formatAmount(Number(transaction.amount))}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell className="w-12">
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
      </TableCell>
    </TableRow>
  );
});
