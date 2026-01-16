import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface BPRevenueStream {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  name: string;
  description: string | null;
  color: string;
  model: 'fixed' | 'units' | 'growth' | 'subscription';
  is_active: boolean;
  initial_subscribers: number;
  monthly_price: number;
  churn_rate: number;
  growth_rate: number;
  vat_rate: number;
  bad_debt_rate: number;
  created_at: string;
  updated_at: string;
}

export function useBPRevenueStreams(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['bp_revenue_streams', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      
      const { data, error } = await supabase
        .from('bp_revenue_streams')
        .select('*')
        .eq('business_plan_id', businessPlanId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as BPRevenueStream[];
    },
    enabled: !!user && !!businessPlanId,
  });

  const createStream = useMutation({
    mutationFn: async (data: Partial<BPRevenueStream>) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');

      const { data: newStream, error } = await supabase
        .from('bp_revenue_streams')
        .insert({
          user_id: user.id,
          business_plan_id: businessPlanId,
          name: data.name || 'Nouveau flux',
          description: data.description || null,
          color: data.color || 'hsl(142, 76%, 36%)',
          model: data.model || 'fixed',
          is_active: true,
          initial_subscribers: data.initial_subscribers || 0,
          monthly_price: data.monthly_price || 0,
          churn_rate: data.churn_rate || 0.05,
          growth_rate: data.growth_rate || 0.10,
          vat_rate: data.vat_rate || 0.20,
          bad_debt_rate: data.bad_debt_rate || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return newStream;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', businessPlanId] });
      toast.success('Flux de revenus créé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateStream = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPRevenueStream> & { id: string }) => {
      const { error } = await supabase
        .from('bp_revenue_streams')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', businessPlanId] });
      toast.success('Flux mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteStream = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_revenue_streams')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', businessPlanId] });
      toast.success('Flux supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const totalMonthlyRevenue = streams.reduce((sum, s) => {
    if (s.model === 'subscription') {
      return sum + (s.initial_subscribers * s.monthly_price);
    }
    return sum + s.monthly_price;
  }, 0);

  return {
    streams,
    isLoading,
    createStream,
    updateStream,
    deleteStream,
    totalMonthlyRevenue,
  };
}
