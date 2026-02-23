import { useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';
import { sortTransactions, filterTransactions, SortOption } from '@/hooks/useTransactions';

type Transaction = Tables<'transactions'>;
export type TabFilter = 'all' | 'categorized' | 'uncategorized' | 'ignored';

interface UseTransactionFiltersParams {
  transactions: Transaction[];
  categories: Category[];
  accountToBankMap: Map<string, string>;
}

export function useTransactionFilters({ transactions, categories, accountToBankMap }: UseTransactionFiltersParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [bankFilter, setBankFilter] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Category lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const getCategoryName = useCallback((categoryId: string | null) => {
    if (!categoryId) return 'Non catégorisé';
    return categoryMap.get(categoryId)?.name || 'Non catégorisé';
  }, [categoryMap]);

  const getCategoryColor = useCallback((categoryId: string | null) => {
    if (!categoryId) return undefined;
    return categoryMap.get(categoryId)?.color;
  }, [categoryMap]);

  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);
  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);

  // Filtered + sorted transactions
  const filteredTransactions = useMemo(() => {
    let baseFiltered = transactions;
    if (tabFilter === 'categorized') {
      baseFiltered = transactions.filter(t => t.category_id !== null && !t.is_ignored);
    } else if (tabFilter === 'uncategorized') {
      baseFiltered = transactions.filter(t => t.category_id === null && !t.is_ignored);
    } else if (tabFilter === 'ignored') {
      baseFiltered = transactions.filter(t => t.is_ignored);
    } else {
      baseFiltered = transactions.filter(t => !t.is_ignored);
    }

    if (dateFrom) {
      const fromStr = format(dateFrom, 'yyyy-MM-dd');
      baseFiltered = baseFiltered.filter(t => t.date >= fromStr);
    }
    if (dateTo) {
      const toStr = format(dateTo, 'yyyy-MM-dd');
      baseFiltered = baseFiltered.filter(t => t.date <= toStr);
    }

    if (bankFilter) {
      baseFiltered = baseFiltered.filter(t => {
        const bankName = accountToBankMap.get(t.bank_account_name || '') || t.bank_account_name;
        return bankName === bankFilter;
      });
    }

    const filtered = filterTransactions(baseFiltered, {
      searchQuery,
      categoryFilter: selectedCategoryFilter,
      getCategoryName,
    });
    return sortTransactions(filtered, sortOption);
  }, [transactions, tabFilter, bankFilter, dateFrom, dateTo, searchQuery, selectedCategoryFilter, sortOption, getCategoryName, accountToBankMap]);

  // Tab counts
  const tabCounts = useMemo(() => {
    let categorized = 0;
    let uncategorized = 0;
    let ignored = 0;
    for (const t of transactions) {
      if (t.is_ignored) { ignored++; continue; }
      if (t.category_id) categorized++;
      else uncategorized++;
    }
    return { all: transactions.length - ignored, categorized, uncategorized, ignored };
  }, [transactions]);

  return {
    // State
    searchQuery, setSearchQuery,
    selectedCategoryFilter, setSelectedCategoryFilter,
    sortOption, setSortOption,
    bankFilter, setBankFilter,
    tabFilter, setTabFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    // Derived
    filteredTransactions,
    tabCounts,
    categoryMap,
    getCategoryName,
    getCategoryColor,
    incomeCategories,
    expenseCategories,
  };
}
