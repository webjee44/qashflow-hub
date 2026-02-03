import { useState, useMemo } from 'react';
import { Check, PlusCircle, Search, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Category } from '@/hooks/useCategories';

interface CategorySearchSelectProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCreateCategory?: () => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  getCategoryName: (categoryId: string | null) => string;
  getCategoryColor: (categoryId: string | null) => string | undefined;
  isUncategorized?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function CategorySearchSelect({
  value,
  onChange,
  onCreateCategory,
  incomeCategories,
  expenseCategories,
  getCategoryName,
  getCategoryColor,
  isUncategorized = !value,
  className,
  triggerClassName,
}: CategorySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const categoryColor = getCategoryColor(value);

  // Filter categories based on search
  const filteredIncomeCategories = useMemo(() => {
    if (!search) return incomeCategories;
    const lowerSearch = search.toLowerCase();
    return incomeCategories.filter(cat => 
      cat.name.toLowerCase().includes(lowerSearch)
    );
  }, [incomeCategories, search]);

  const filteredExpenseCategories = useMemo(() => {
    if (!search) return expenseCategories;
    const lowerSearch = search.toLowerCase();
    return expenseCategories.filter(cat => 
      cat.name.toLowerCase().includes(lowerSearch)
    );
  }, [expenseCategories, search]);

  const hasResults = filteredIncomeCategories.length > 0 || filteredExpenseCategories.length > 0;

  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    setOpen(false);
    setSearch('');
  };

  const handleCreateCategory = () => {
    onCreateCategory?.();
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-9",
            isUncategorized && "bg-warning/20 border-warning text-warning dark:bg-warning/10",
            triggerClassName
          )}
        >
          {isUncategorized ? (
            <span>Sélect. catégorie</span>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor }}
              />
              <span className="truncate">{getCategoryName(value)}</span>
            </div>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[280px] p-0", className)} align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher une catégorie..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Aucune catégorie trouvée</CommandEmpty>
            
            {/* Create new category option */}
            {onCreateCategory && (
              <>
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
              </>
            )}

            {/* Remove category option */}
            {value && (
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

            {/* Income categories */}
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
                    {value === cat.id && (
                      <Check className="ml-2 h-4 w-4 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Expense categories */}
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
                      {value === cat.id && (
                        <Check className="ml-2 h-4 w-4 shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* No results but search is active */}
            {!hasResults && search && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Aucune catégorie "{search}"
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
