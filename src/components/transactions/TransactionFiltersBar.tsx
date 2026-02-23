import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, CalendarIcon, Tag, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

      {/* Category filter */}
      <Select value={selectedCategoryFilter || 'all'} onValueChange={(v) => onCategoryFilterChange(v === 'all' ? null : v)}>
        <SelectTrigger className="w-auto min-w-[180px] gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <SelectValue placeholder="Toutes les catégories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes les catégories</SelectItem>
          <SelectItem value="Non catégorisé">Non catégorisé</SelectItem>
          {incomeCategories.length > 0 && (
            <>
              <SelectItem value="__header_income" disabled className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">— Encaissements —</SelectItem>
              {incomeCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </>
          )}
          {expenseCategories.length > 0 && (
            <>
              <SelectItem value="__header_expense" disabled className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">— Décaissements —</SelectItem>
              {expenseCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </>
          )}
        </SelectContent>
      </Select>

      <BankFilterDropdown value={bankFilter} onChange={onBankFilterChange} banks={uniqueBankNames} />
      <SortDropdown value={sortOption} onChange={onSortChange} />
    </motion.div>
  );
});
