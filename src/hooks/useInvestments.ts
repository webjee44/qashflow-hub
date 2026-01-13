import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, parseISO, addMonths, differenceInMonths } from 'date-fns';
import { calculateMonthlyDepreciation } from '@/lib/french-rates';

export interface Investment {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  category: string;
  purchase_date: string;
  purchase_amount: number;
  depreciation_years: number;
  depreciation_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useInvestments() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ['bp_investments', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_investments')
        .select('*')
        .order('purchase_date', { ascending: false });

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Investment[];
    },
    enabled: !!user,
  });

  const createInvestment = useMutation({
    mutationFn: async (data: Partial<Investment>) => {
      if (!user) throw new Error('Not authenticated');

      const { data: newInvestment, error } = await supabase
        .from('bp_investments')
        .insert({
          user_id: user.id,
          company_id: currentCompany?.id || null,
          name: data.name || 'Nouvel investissement',
          category: data.category || 'equipment',
          purchase_date: data.purchase_date,
          purchase_amount: data.purchase_amount || 0,
          depreciation_years: data.depreciation_years || 5,
          depreciation_method: data.depreciation_method || 'linear',
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newInvestment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_investments'] });
      toast({ title: 'Investissement créé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateInvestment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Investment> & { id: string }) => {
      const { error } = await supabase
        .from('bp_investments')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_investments'] });
      toast({ title: 'Investissement mis à jour' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const deleteInvestment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_investments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_investments'] });
      toast({ title: 'Investissement supprimé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Calcul de l'amortissement pour un mois donné
  const getDepreciationForMonth = (month: Date): number => {
    const monthStart = startOfMonth(month);
    
    return investments.reduce((total, inv) => {
      const purchaseDate = startOfMonth(parseISO(inv.purchase_date));
      const endDate = addMonths(purchaseDate, inv.depreciation_years * 12);
      
      // Vérifier si l'immobilisation est encore en cours d'amortissement
      if (monthStart < purchaseDate || monthStart >= endDate) return total;
      
      const monthlyDep = calculateMonthlyDepreciation(
        Number(inv.purchase_amount),
        inv.depreciation_years,
        inv.depreciation_method as 'linear' | 'degressive'
      );
      
      return total + monthlyDep;
    }, 0);
  };

  // Valeur nette comptable d'un investissement à une date
  const getNetBookValue = (investment: Investment, atDate: Date): number => {
    const purchaseDate = startOfMonth(parseISO(investment.purchase_date));
    const monthsElapsed = Math.max(0, differenceInMonths(atDate, purchaseDate));
    const totalMonths = investment.depreciation_years * 12;
    
    if (monthsElapsed >= totalMonths) return 0;
    
    const monthlyDep = calculateMonthlyDepreciation(
      Number(investment.purchase_amount),
      investment.depreciation_years,
      investment.depreciation_method as 'linear' | 'degressive'
    );
    
    return Math.max(0, Number(investment.purchase_amount) - (monthlyDep * monthsElapsed));
  };

  // Total des immobilisations brutes
  const getTotalGrossValue = (): number => {
    return investments.reduce((sum, inv) => sum + Number(inv.purchase_amount), 0);
  };

  // Total des amortissements cumulés
  const getTotalAccumulatedDepreciation = (atDate: Date): number => {
    return investments.reduce((total, inv) => {
      const gross = Number(inv.purchase_amount);
      const netValue = getNetBookValue(inv, atDate);
      return total + (gross - netValue);
    }, 0);
  };

  return {
    investments,
    isLoading,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    getDepreciationForMonth,
    getNetBookValue,
    getTotalGrossValue,
    getTotalAccumulatedDepreciation,
  };
}
