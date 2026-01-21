import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { toast } from 'sonner';
import { type RevenueModel } from '@/constants/bpConstants';

export interface BPRevenueStream {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  color: string;
  model: RevenueModel;
  is_active: boolean;
  initial_subscribers: number;
  monthly_price: number;
  churn_rate: number;
  growth_rate: number;
  vat_rate: number;
  bad_debt_rate: number;
  annual_growth_rate: number;
  growth_rate_year2: number;
  growth_rate_year3: number;
  growth_rate_year4: number;
  // Purchase cost fields
  has_purchase_cost: boolean;
  purchase_price: number;
  created_at: string;
  updated_at: string;
}

export function useBPRevenueStreams() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['bp_revenue_streams', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('bp_revenue_streams')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as BPRevenueStream[];
    },
    enabled: !!user && !!companyId,
  });

  const createStream = useMutation({
    mutationFn: async (data: Partial<BPRevenueStream>) => {
      if (!user || !companyId) throw new Error('Not authenticated or no company');

      const { data: newStream, error } = await supabase
        .from('bp_revenue_streams')
        .insert({
          user_id: user.id,
          company_id: companyId,
          name: data.name || 'Nouveau flux',
          description: data.description || null,
          color: data.color || 'hsl(142, 76%, 36%)',
          model: data.model || 'variable',
          is_active: true,
          initial_subscribers: data.initial_subscribers || 0,
          monthly_price: data.monthly_price || 0,
          churn_rate: data.churn_rate || 0.05,
          growth_rate: data.growth_rate || 0.10,
          vat_rate: data.vat_rate || 0.20,
          bad_debt_rate: data.bad_debt_rate || 0,
          annual_growth_rate: data.annual_growth_rate ?? 0.10,
          growth_rate_year2: data.growth_rate_year2 ?? 0.10,
          growth_rate_year3: data.growth_rate_year3 ?? 0.10,
          growth_rate_year4: data.growth_rate_year4 ?? 0.10,
          has_purchase_cost: data.has_purchase_cost ?? false,
          purchase_price: data.purchase_price ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return newStream;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', companyId] });
      toast.success('Flux mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteStream = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('bp_revenue_streams')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', companyId] });
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
