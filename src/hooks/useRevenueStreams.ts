import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, format, addMonths } from 'date-fns';

export interface RevenueStream {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  color: string;
  model: 'fixed' | 'units' | 'growth' | 'subscription';
  is_active: boolean;
  // Subscription model fields
  initial_subscribers: number;
  monthly_price: number;
  churn_rate: number;
  growth_rate: number;
  created_at: string;
  updated_at: string;
}

export interface RevenueForecast {
  id: string;
  stream_id: string;
  user_id: string;
  company_id: string | null;
  month: string;
  amount: number;
  units: number | null;
  unit_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useRevenueStreams() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch revenue streams
  const { data: streams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ['bp_revenue_streams', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_revenue_streams')
        .select('*')
        .order('created_at', { ascending: true });

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RevenueStream[];
    },
    enabled: !!user,
  });

  // Fetch revenue forecasts for next 24 months
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['bp_revenue_forecasts', currentCompany?.id],
    queryFn: async () => {
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(addMonths(startOfMonth(new Date()), 24), 'yyyy-MM-dd');

      let query = supabase
        .from('bp_revenue_forecasts')
        .select('*')
        .gte('month', startDate)
        .lte('month', endDate);

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RevenueForecast[];
    },
    enabled: !!user,
  });

  // Create stream mutation
  const createStream = useMutation({
    mutationFn: async (data: Partial<RevenueStream>) => {
      if (!user) throw new Error('Not authenticated');

      const { data: newStream, error } = await supabase
        .from('bp_revenue_streams')
        .insert({
          user_id: user.id,
          company_id: currentCompany?.id || null,
          name: data.name || 'Nouveau flux',
          description: data.description || null,
          color: data.color || 'hsl(142, 76%, 36%)',
          model: data.model || 'fixed',
          is_active: true,
          initial_subscribers: data.initial_subscribers || 0,
          monthly_price: data.monthly_price || 0,
          churn_rate: data.churn_rate || 0.05,
          growth_rate: data.growth_rate || 0.10,
        })
        .select()
        .single();

      if (error) throw error;
      return newStream;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams'] });
      toast({ title: 'Flux créé', description: 'Le flux de revenus a été créé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Update stream mutation
  const updateStream = useMutation({
    mutationFn: async ({ id, ...data }: Partial<RevenueStream> & { id: string }) => {
      const { error } = await supabase
        .from('bp_revenue_streams')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams'] });
      toast({ title: 'Flux mis à jour' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Delete stream mutation
  const deleteStream = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_revenue_streams')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams'] });
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_forecasts'] });
      toast({ title: 'Flux supprimé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Upsert forecast mutation
  const upsertForecast = useMutation({
    mutationFn: async (data: { streamId: string; month: Date; amount: number; units?: number; unitPrice?: number }) => {
      if (!user) throw new Error('Not authenticated');

      const monthStr = format(startOfMonth(data.month), 'yyyy-MM-dd');

      const { error } = await supabase
        .from('bp_revenue_forecasts')
        .upsert({
          stream_id: data.streamId,
          user_id: user.id,
          company_id: currentCompany?.id || null,
          month: monthStr,
          amount: data.amount,
          units: data.units || null,
          unit_price: data.unitPrice || null,
        }, {
          onConflict: 'stream_id,month',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_forecasts'] });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Helper: get forecast for a stream and month
  const getForecast = (streamId: string, month: Date): number => {
    const stream = streams.find(s => s.id === streamId);
    if (!stream) return 0;

    // For subscription model, calculate MRR automatically
    if (stream.model === 'subscription') {
      const startMonth = startOfMonth(new Date());
      const targetMonth = startOfMonth(month);
      const monthsDiff = Math.round((targetMonth.getTime() - startMonth.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      if (monthsDiff < 0) return 0;
      
      const netGrowth = (stream.growth_rate || 0.10) - (stream.churn_rate || 0.05);
      const subscribers = Math.round((stream.initial_subscribers || 0) * Math.pow(1 + netGrowth, monthsDiff));
      return subscribers * (stream.monthly_price || 0);
    }

    // For other models, use stored forecast
    const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');
    const forecast = forecasts.find(f => f.stream_id === streamId && f.month === monthStr);
    return forecast?.amount || 0;
  };

  // Helper: get total revenue for a month
  const getTotalRevenue = (month: Date): number => {
    return streams.reduce((sum, stream) => sum + getForecast(stream.id, month), 0);
  };

  return {
    streams,
    forecasts,
    isLoading: streamsLoading || forecastsLoading,
    createStream,
    updateStream,
    deleteStream,
    upsertForecast,
    getForecast,
    getTotalRevenue,
  };
}
