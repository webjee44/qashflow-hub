import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface BusinessPlan {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  status: 'draft' | 'finalized';
  description: string | null;
  bp_start_date: string | null;
  bp_years: number | null;
  fiscal_year_start_month: number | null;
  fiscal_year_start_day: number | null;
  customer_payment_delay: number | null;
  supplier_payment_delay: number | null;
  initial_cash: number | null;
  tax_regime: string | null;
  is_pme: boolean | null;
  finalized_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type BusinessPlanInsert = Omit<BusinessPlan, 'id' | 'created_at' | 'updated_at'>;
export type BusinessPlanUpdate = Partial<Omit<BusinessPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export function useBusinessPlans() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: businessPlans = [], isLoading } = useQuery({
    queryKey: ['business_plans', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('business_plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BusinessPlan[];
    },
    enabled: !!user,
  });

  const createBusinessPlan = useMutation({
    mutationFn: async (data: Omit<BusinessPlanInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data: newBP, error } = await supabase
        .from('business_plans')
        .insert({
          ...data,
          user_id: user.id,
          company_id: currentCompany?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newBP as BusinessPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_plans'] });
      toast({ title: 'Business Plan créé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateBusinessPlan = useMutation({
    mutationFn: async ({ id, ...data }: BusinessPlanUpdate & { id: string }) => {
      const { error } = await supabase
        .from('business_plans')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_plans'] });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const deleteBusinessPlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('business_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_plans'] });
      toast({ title: 'Business Plan supprimé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const finalizeBusinessPlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('business_plans')
        .update({ 
          status: 'finalized', 
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_plans'] });
      toast({ title: 'Business Plan finalisé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const duplicateBusinessPlan = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');

      // Get the original BP
      const { data: original, error: fetchError } = await supabase
        .from('business_plans')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Create a copy
      const { data: newBP, error: insertError } = await supabase
        .from('business_plans')
        .insert({
          user_id: user.id,
          company_id: original.company_id,
          name: `${original.name} (copie)`,
          status: 'draft',
          description: original.description,
          bp_start_date: original.bp_start_date,
          bp_years: original.bp_years,
          fiscal_year_start_month: original.fiscal_year_start_month,
          fiscal_year_start_day: original.fiscal_year_start_day,
          customer_payment_delay: original.customer_payment_delay,
          supplier_payment_delay: original.supplier_payment_delay,
          initial_cash: original.initial_cash,
          tax_regime: original.tax_regime,
          is_pme: original.is_pme,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return newBP as BusinessPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_plans'] });
      toast({ title: 'Business Plan dupliqué' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  return {
    businessPlans,
    isLoading,
    createBusinessPlan,
    updateBusinessPlan,
    deleteBusinessPlan,
    finalizeBusinessPlan,
    duplicateBusinessPlan,
  };
}
