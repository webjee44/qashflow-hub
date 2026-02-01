import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { logError } from '@/lib/logger';

export interface CategoryCounts {
  [categoryId: string]: number;
}

/**
 * Hook to fetch transaction counts per category on demand.
 * Uses a single aggregate query for performance.
 */
export function useCategoryTransactionCounts() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [counts, setCounts] = useState<CategoryCounts>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!user || loading) return;

    setLoading(true);
    try {
      // Use RPC or raw query to get counts grouped by category_id
      // We need to count transactions per category
      let query = supabase
        .from('transactions')
        .select('category_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('category_id', 'is', null);

      if (currentCompany) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Count occurrences per category_id
      const countMap: CategoryCounts = {};
      for (const tx of data || []) {
        if (tx.category_id) {
          countMap[tx.category_id] = (countMap[tx.category_id] || 0) + 1;
        }
      }

      setCounts(countMap);
      setLoaded(true);
    } catch (error) {
      logError('Error fetching category transaction counts:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentCompany, loading]);

  const getCount = useCallback((categoryId: string): number => {
    return counts[categoryId] || 0;
  }, [counts]);

  const isOrphan = useCallback((categoryId: string): boolean => {
    // Only consider orphan if we've loaded counts
    if (!loaded) return false;
    return !counts[categoryId] || counts[categoryId] === 0;
  }, [counts, loaded]);

  const reset = useCallback(() => {
    setCounts({});
    setLoaded(false);
  }, []);

  return {
    counts,
    loading,
    loaded,
    fetchCounts,
    getCount,
    isOrphan,
    reset,
  };
}
