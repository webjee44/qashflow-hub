import { memo } from 'react';
import { cn } from '@/lib/utils';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles,
  Check,
  Tag,
  Building2,
  PlusCircle,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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

interface TransactionRowProps {
  transaction: Transaction;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string | null) => void;
  onCreateCategory: (transactionId: string) => void;
  getCategoryName: (categoryId: string | null) => string;
  getCategoryColor: (categoryId: string | null) => string | undefined;
  getBankAccountDisplay: (accountName: string | null) => string | null;
  incomeCategories: Category[];
  expenseCategories: Category[];
  formatAmount: (amount: number) => string;
  formatDate: (date: string) => string;
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  isSelected,
  onToggleSelection,
  onUpdateCategory,
  onCreateCategory,
  getCategoryName,
  getCategoryColor,
  getBankAccountDisplay,
  incomeCategories,
  expenseCategories,
  formatAmount,
  formatDate,
}: TransactionRowProps) {
  return (
    <div
      className={cn(
        "p-5 hover:bg-muted/30 transition-colors group",
        isSelected && "bg-primary/5"
      )}
    >
      <div className="flex items-center gap-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(transaction.id)}
          className="shrink-0"
        />

        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
          transaction.type === 'income' 
            ? 'bg-success/10 text-success' 
            : 'bg-destructive/10 text-destructive'
        )}>
          {transaction.type === 'income' 
            ? <ArrowUpRight className="w-6 h-6" />
            : <ArrowDownRight className="w-6 h-6" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">
              {transaction.description}
            </p>
            {transaction.ai_confidence && (
              <div className="flex items-center gap-1 text-accent shrink-0">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium">
                  {Math.round(Number(transaction.ai_confidence) * 100)}% IA
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                >
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs cursor-pointer hover:bg-muted transition-colors",
                      !transaction.category_id && "border-dashed border-warning text-warning"
                    )}
                    style={transaction.category_id ? {
                      borderColor: getCategoryColor(transaction.category_id),
                      color: getCategoryColor(transaction.category_id),
                    } : undefined}
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {getCategoryName(transaction.category_id)}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={5} collisionPadding={20} className="w-56 max-h-80 overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => onCreateCategory(transaction.id)}
                  className="flex items-center gap-2 text-primary"
                >
                  <PlusCircle className="w-4 h-4" />
                  Créer une catégorie
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {transaction.category_id && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onUpdateCategory(transaction.id, null)}
                      className="text-muted-foreground"
                    >
                      Retirer la catégorie
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {incomeCategories.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Encaissements
                    </div>
                    {incomeCategories.map(cat => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => onUpdateCategory(transaction.id, cat.id)}
                        className="flex items-center gap-2"
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                        {transaction.category_id === cat.id && (
                          <Check className="w-4 h-4 ml-auto shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                
                {expenseCategories.length > 0 && (
                  <>
                    {incomeCategories.length > 0 && <DropdownMenuSeparator />}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Décaissements
                    </div>
                    {expenseCategories.map(cat => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => onUpdateCategory(transaction.id, cat.id)}
                        className="flex items-center gap-2"
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                        {transaction.category_id === cat.id && (
                          <Check className="w-4 h-4 ml-auto shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-sm text-muted-foreground">
              {formatDate(transaction.date)}
            </span>
            {transaction.source && (
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                {transaction.source}
              </span>
            )}
            {transaction.bank_account_name && (
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {getBankAccountDisplay(transaction.bank_account_name)}
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className={cn(
            "text-xl font-bold",
            transaction.type === 'income' ? 'text-success' : 'text-foreground'
          )}>
            {transaction.type === 'income' ? '+' : '-'}{formatAmount(Number(transaction.amount))}
          </p>
        </div>
      </div>
    </div>
  );
});
