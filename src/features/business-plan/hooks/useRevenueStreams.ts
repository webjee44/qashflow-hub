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
  model: 'variable' | 'subscription';
  is_active: boolean;
  // Subscription model fields
  initial_subscribers: number;
  monthly_price: number;
  churn_rate: number;
  growth_rate: number;
  // Annual growth rates - year-specific (N+1, N+2, N+3)
  annual_growth_rate: number; // Legacy, kept for compatibility
  growth_rate_year2: number;
  growth_rate_year3: number;
  growth_rate_year4: number;
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

  // Fetch BP settings to get the correct start date
  const { data: bpSettings } = useQuery({
    queryKey: ['bp_settings', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data } = await supabase
        .from('bp_settings')
        .select('bp_start_date, bp_years')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!currentCompany?.id,
  });

  // Determine the correct start date (from settings or fallback to current date)
  const bpStartDate = bpSettings?.bp_start_date 
    ? startOfMonth(new Date(bpSettings.bp_start_date))
    : startOfMonth(new Date());
  const bpYears = bpSettings?.bp_years ?? 3;

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

  // Fetch revenue forecasts - use BP start date instead of current date
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['bp_revenue_forecasts', currentCompany?.id, bpSettings?.bp_start_date],
    queryFn: async () => {
      // Use BP start date from settings, covering the full plan duration
      const startDate = format(bpStartDate, 'yyyy-MM-dd');
      const endDate = format(addMonths(bpStartDate, bpYears * 12 + 12), 'yyyy-MM-dd');

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
    enabled: !!user && !!bpSettings,
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
          model: data.model || 'variable',
          is_active: true,
          initial_subscribers: data.initial_subscribers || 0,
          monthly_price: data.monthly_price || 0,
          churn_rate: data.churn_rate || 5,
          growth_rate: data.growth_rate || 10,
          annual_growth_rate: data.annual_growth_rate ?? 10,
          growth_rate_year2: data.growth_rate_year2 ?? 10,
          growth_rate_year3: data.growth_rate_year3 ?? 10,
          growth_rate_year4: data.growth_rate_year4 ?? 10,
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

    const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');
    const manualForecast = forecasts.find(f => f.stream_id === streamId && f.month === monthStr);

    // PRIORITY: Always use manual forecast if it exists (for ALL models)
    if (manualForecast && manualForecast.amount != null && manualForecast.amount > 0) {
      return manualForecast.amount;
    }

    // FALLBACK: For subscription model, calculate MRR automatically from BP start date
    if (stream.model === 'subscription') {
      const startMonth = bpStartDate;
      const targetMonth = startOfMonth(month);
      const monthsDiff = Math.round((targetMonth.getTime() - startMonth.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      if (monthsDiff < 0) return 0;
      
      const growthPct = (stream.growth_rate ?? 10) / 100;
      const churnPct = (stream.churn_rate ?? 5) / 100;
      const netGrowth = growthPct - churnPct;
      const subscribers = Math.round((stream.initial_subscribers || 0) * Math.pow(1 + netGrowth, monthsDiff));
      return subscribers * (stream.monthly_price || 0);
    }

    // For variable model with no manual entry, return 0
    return 0;
  };

  // Helper: get total revenue for a month
  const getTotalRevenue = (month: Date): number => {
    return streams.reduce((sum, stream) => sum + getForecast(stream.id, month), 0);
  };

  // Helper: get growth rate for a specific year
  const getYearGrowthRate = (stream: any, yearIndex: number): number => {
    switch (yearIndex) {
      case 1: return (stream.growth_rate_year2 ?? stream.annual_growth_rate ?? 10) / 100;
      case 2: return (stream.growth_rate_year3 ?? stream.annual_growth_rate ?? 10) / 100;
      case 3: return (stream.growth_rate_year4 ?? stream.annual_growth_rate ?? 10) / 100;
      default: return (stream.growth_rate_year4 ?? stream.annual_growth_rate ?? 10) / 100;
    }
  };

  // Helper: get yearly revenue for a stream, with automatic projection for years 2+
  const getYearlyRevenue = (streamId: string, yearIndex: number, year1Months: Date[]): number => {
    const stream = streams.find(s => s.id === streamId);
    if (!stream) return 0;

    // Year 1: sum of monthly forecasts
    const year1Total = year1Months.reduce((sum, month) => sum + getForecast(streamId, month), 0);
    
    if (yearIndex === 0) return year1Total;

    // Years 2+: apply compound growth with year-specific rates
    let projectedTotal = year1Total;
    for (let i = 1; i <= yearIndex; i++) {
      const rate = getYearGrowthRate(stream, i);
      projectedTotal *= (1 + rate);
    }
    return projectedTotal;
  };

  // Helper: get total yearly revenue across all streams
  const getTotalYearlyRevenue = (yearIndex: number, year1Months: Date[]): number => {
    return streams.reduce((sum, stream) => sum + getYearlyRevenue(stream.id, yearIndex, year1Months), 0);
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
    getYearlyRevenue,
    getTotalYearlyRevenue,
  };
}
