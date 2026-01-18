import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';

export interface BPInvestment {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
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

export const INVESTMENT_CATEGORIES = {
  equipment: { label: 'Matériel & Équipement', icon: 'Wrench' },
  computer: { label: 'Informatique', icon: 'Laptop' },
  vehicle: { label: 'Véhicule', icon: 'Car' },
  furniture: { label: 'Mobilier', icon: 'Armchair' },
  software: { label: 'Logiciels', icon: 'Code' },
  fittings: { label: 'Aménagements', icon: 'Building' },
  other: { label: 'Autres', icon: 'MoreHorizontal' },
};

export function useBPInvestments(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ['bp_investments', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      
      const { data, error } = await supabase
        .from('bp_investments')
        .select('*')
        .eq('business_plan_id', businessPlanId)
        .order('purchase_date', { ascending: true });
      
      if (error) throw error;
      return (data || []) as BPInvestment[];
    },
    enabled: !!user && !!businessPlanId,
  });

  const createInvestment = useMutation({
    mutationFn: async (data: Partial<BPInvestment>) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');

      const { data: newInvestment, error } = await supabase
        .from('bp_investments')
        .insert({
          user_id: user.id,
          business_plan_id: businessPlanId,
          name: data.name || 'Nouvel investissement',
          category: data.category || 'equipment',
          purchase_date: data.purchase_date || format(new Date(), 'yyyy-MM-dd'),
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
      queryClient.invalidateQueries({ queryKey: ['bp_investments', businessPlanId] });
      toast.success('Investissement créé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateInvestment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPInvestment> & { id: string }) => {
      const { error } = await supabase
        .from('bp_investments')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_investments', businessPlanId] });
      toast.success('Investissement mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
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
      queryClient.invalidateQueries({ queryKey: ['bp_investments', businessPlanId] });
      toast.success('Investissement supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const totalInvestments = investments.reduce((sum, inv) => sum + Number(inv.purchase_amount), 0);
  const yearlyDepreciation = investments.reduce((sum, inv) => {
    return sum + (Number(inv.purchase_amount) / inv.depreciation_years);
  }, 0);

  return {
    investments,
    isLoading,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    totalInvestments,
    yearlyDepreciation,
    categories: INVESTMENT_CATEGORIES,
  };
}
