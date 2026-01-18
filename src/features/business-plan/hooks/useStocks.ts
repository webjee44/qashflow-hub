import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import { useCallback, useMemo } from 'react';

export interface Stock {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  initial_stock: number;
  purchase_amount: number;
  final_stock: number;
  fiscal_year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useStocks() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ['bp_stocks', currentCompany?.id],
    queryFn: async () => {
      const query = supabase
        .from('bp_stocks')
        .select('*')
        .order('fiscal_year', { ascending: true });

      if (currentCompany) {
        query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Stock[];
    },
    enabled: !!user,
  });

  const createStock = useMutation({
    mutationFn: async (stock: Partial<Stock>) => {
      const insertData = {
        name: stock.name!,
        initial_stock: stock.initial_stock || 0,
        purchase_amount: stock.purchase_amount || 0,
        final_stock: stock.final_stock || 0,
        fiscal_year: stock.fiscal_year || 1,
        notes: stock.notes || null,
        user_id: user!.id,
        company_id: currentCompany?.id || null,
      };
      
      const { data, error } = await supabase
        .from('bp_stocks')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_stocks'] });
      toast.success('Stock créé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création');
      console.error(error);
    },
  });

  const updateStock = useMutation({
    mutationFn: async (stock: Stock) => {
      const { data, error } = await supabase
        .from('bp_stocks')
        .update(stock)
        .eq('id', stock.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_stocks'] });
      toast.success('Stock mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    },
  });

  const deleteStock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bp_stocks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_stocks'] });
      toast.success('Stock supprimé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    },
  });

  // Calculate stock variation for a fiscal year (initial - final + purchases = cost of goods sold)
  // Variation = Initial Stock + Purchases - Final Stock
  // If positive = stock decreases = expense
  // If negative = stock increases = reduces expenses
  const getStockVariation = useCallback((fiscalYear: number): number => {
    const yearStocks = stocks.filter(s => s.fiscal_year === fiscalYear);
    return yearStocks.reduce((sum, s) => {
      const variation = Number(s.initial_stock) + Number(s.purchase_amount) - Number(s.final_stock);
      return sum + variation;
    }, 0);
  }, [stocks]);

  // Get total purchases for a fiscal year
  const getTotalPurchases = useCallback((fiscalYear: number): number => {
    const yearStocks = stocks.filter(s => s.fiscal_year === fiscalYear);
    return yearStocks.reduce((sum, s) => sum + Number(s.purchase_amount), 0);
  }, [stocks]);

  // Get stock value at end of fiscal year
  const getStockValueAtEnd = useCallback((fiscalYear: number): number => {
    const yearStocks = stocks.filter(s => s.fiscal_year === fiscalYear);
    return yearStocks.reduce((sum, s) => sum + Number(s.final_stock), 0);
  }, [stocks]);

  // Get stock rotation rate (COGS / Average Stock)
  const getStockRotationRate = useCallback((fiscalYear: number): number => {
    const yearStocks = stocks.filter(s => s.fiscal_year === fiscalYear);
    const cogs = yearStocks.reduce((sum, s) => {
      return sum + Number(s.initial_stock) + Number(s.purchase_amount) - Number(s.final_stock);
    }, 0);
    const avgStock = yearStocks.reduce((sum, s) => {
      return sum + (Number(s.initial_stock) + Number(s.final_stock)) / 2;
    }, 0);
    
    return avgStock > 0 ? cogs / avgStock : 0;
  }, [stocks]);

  // Calculate stock days (365 / rotation rate)
  const getStockDays = useCallback((fiscalYear: number): number => {
    const rotationRate = getStockRotationRate(fiscalYear);
    return rotationRate > 0 ? 365 / rotationRate : 0;
  }, [getStockRotationRate]);

  return {
    stocks,
    isLoading,
    createStock,
    updateStock,
    deleteStock,
    getStockVariation,
    getTotalPurchases,
    getStockValueAtEnd,
    getStockRotationRate,
    getStockDays,
  };
}
