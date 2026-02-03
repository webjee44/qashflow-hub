import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles,
  Check,
  Tag,
  Building2,
  PlusCircle,
  Search,
  XCircle,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Filter categories based on search
  const filteredIncomeCategories = search
    ? incomeCategories.filter(cat => cat.name.toLowerCase().includes(search.toLowerCase()))
    : incomeCategories;
  const filteredExpenseCategories = search
    ? expenseCategories.filter(cat => cat.name.toLowerCase().includes(search.toLowerCase()))
    : expenseCategories;

  const handleSelect = (categoryId: string | null) => {
    onUpdateCategory(transaction.id, categoryId);
    setOpen(false);
    setSearch('');
  };

  const handleCreateCategory = () => {
    onCreateCategory(transaction.id);
    setOpen(false);
    setSearch('');
  };

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
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
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
              </PopoverTrigger>
              <PopoverContent align="start" side="top" sideOffset={5} className="w-[280px] p-0">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Rechercher..." 
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Aucune catégorie trouvée</CommandEmpty>
                    
                    <CommandGroup>
                      <CommandItem
                        onSelect={handleCreateCategory}
                        className="text-primary"
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Créer une catégorie
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />

                    {transaction.category_id && (
                      <>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => handleSelect(null)}
                            className="text-muted-foreground"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Retirer la catégorie
                          </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                      </>
                    )}

                    {filteredIncomeCategories.length > 0 && (
                      <CommandGroup heading="Encaissements">
                        {filteredIncomeCategories.map(cat => (
                          <CommandItem
                            key={cat.id}
                            value={cat.id}
                            onSelect={() => handleSelect(cat.id)}
                          >
                            <div
                              className="mr-2 h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate flex-1">{cat.name}</span>
                            {transaction.category_id === cat.id && (
                              <Check className="ml-2 h-4 w-4 shrink-0" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {filteredExpenseCategories.length > 0 && (
                      <>
                        {filteredIncomeCategories.length > 0 && <CommandSeparator />}
                        <CommandGroup heading="Décaissements">
                          {filteredExpenseCategories.map(cat => (
                            <CommandItem
                              key={cat.id}
                              value={cat.id}
                              onSelect={() => handleSelect(cat.id)}
                            >
                              <div
                                className="mr-2 h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate flex-1">{cat.name}</span>
                              {transaction.category_id === cat.id && (
                                <Check className="ml-2 h-4 w-4 shrink-0" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <span className="text-sm text-muted-foreground">
              {formatDate(transaction.date)}
            </span>
            {transaction.source && transaction.source.toLowerCase() !== 'bridge' && (
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
