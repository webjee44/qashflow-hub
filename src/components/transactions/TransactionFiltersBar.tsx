import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, CalendarIcon, Tag, X, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Category } from '@/hooks/useCategories';
import { SortOption } from '@/hooks/useTransactions';
import { SortDropdown } from './SortDropdown';
import { BankFilterDropdown } from './BankFilterDropdown';

interface TransactionFiltersBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  selectedCategoryFilter: string | null;
  onCategoryFilterChange: (filter: string | null) => void;
  bankFilter: string | null;
  onBankFilterChange: (filter: string | null) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  uniqueBankNames: string[];
}

export const TransactionFiltersBar = memo(function TransactionFiltersBar({
  searchQuery, onSearchChange,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  selectedCategoryFilter, onCategoryFilterChange,
  bankFilter, onBankFilterChange,
  sortOption, onSortChange,
  incomeCategories, expenseCategories,
  uniqueBankNames,
}: TransactionFiltersBarProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25 }}
      className="flex items-center gap-3 flex-wrap"
    >
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une transaction..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Date range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("gap-2 min-w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
            <CalendarIcon className="w-4 h-4" />
            {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Du'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} initialFocus locale={fr} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("gap-2 min-w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
            <CalendarIcon className="w-4 h-4" />
            {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Au'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} initialFocus locale={fr} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {(dateFrom || dateTo) && (
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => { onDateFromChange(undefined); onDateToChange(undefined); }}>
          <X className="w-4 h-4" />
        </Button>
      )}

      {/* Category filter - searchable combobox */}
      <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={categoryOpen}
            className={cn("w-auto min-w-[180px] justify-between gap-2", !selectedCategoryFilter && "text-muted-foreground")}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {selectedCategoryFilter || 'Toutes les catégories'}
            </span>
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher une catégorie..." />
            <CommandList>
              <CommandEmpty>Aucune catégorie trouvée.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all"
                  onSelect={() => { onCategoryFilterChange(null); setCategoryOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !selectedCategoryFilter ? "opacity-100" : "opacity-0")} />
                  Toutes les catégories
                </CommandItem>
                <CommandItem
                  value="Non catégorisé"
                  onSelect={() => { onCategoryFilterChange('Non catégorisé'); setCategoryOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedCategoryFilter === 'Non catégorisé' ? "opacity-100" : "opacity-0")} />
                  Non catégorisé
                </CommandItem>
              </CommandGroup>
              {incomeCategories.length > 0 && (
                <CommandGroup heading="Encaissements">
                  {incomeCategories.map(c => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => { onCategoryFilterChange(c.name); setCategoryOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", selectedCategoryFilter === c.name ? "opacity-100" : "opacity-0")} />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {expenseCategories.length > 0 && (
                <CommandGroup heading="Décaissements">
                  {expenseCategories.map(c => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => { onCategoryFilterChange(c.name); setCategoryOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", selectedCategoryFilter === c.name ? "opacity-100" : "opacity-0")} />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <BankFilterDropdown value={bankFilter} onChange={onBankFilterChange} banks={uniqueBankNames} />
      <SortDropdown value={sortOption} onChange={onSortChange} />
    </motion.div>
  );
});