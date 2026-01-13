import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export interface BPSettings {
  id: string;
  user_id: string;
  company_id: string | null;
  initial_cash: number;
  customer_payment_delay: number;
  supplier_payment_delay: number;
  projection_months: number;
  tax_regime: string;
  is_pme: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS = {
  initial_cash: 0,
  customer_payment_delay: 30,
  supplier_payment_delay: 30,
  projection_months: 24,
  tax_regime: 'is',
  is_pme: true,
};

export function useBPSettings() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['bp_settings', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_settings')
        .select('*');

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as BPSettings | null;
    },
    enabled: !!user,
  });

  // Initialize default settings if none exist
  useEffect(() => {
    const initDefaults = async () => {
      if (!user || isLoading || settings) return;

      try {
        const { error } = await supabase
          .from('bp_settings')
          .insert({
            user_id: user.id,
            company_id: currentCompany?.id || null,
            ...DEFAULT_SETTINGS,
          });

        if (!error) {
          refetch();
        }
      } catch (err) {
        console.error('Error initializing BP settings:', err);
      }
    };

    initDefaults();
  }, [user, currentCompany?.id, isLoading, settings, refetch]);

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (data: Partial<BPSettings>) => {
      if (!user) throw new Error('Not authenticated');

      if (settings?.id) {
        const { error } = await supabase
          .from('bp_settings')
          .update(data)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bp_settings')
          .insert({
            user_id: user.id,
            company_id: currentCompany?.id || null,
            ...DEFAULT_SETTINGS,
            ...data,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_settings'] });
      toast({ title: 'Paramètres mis à jour' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Return settings with defaults
  const effectiveSettings: BPSettings = settings || {
    id: '',
    user_id: user?.id || '',
    company_id: currentCompany?.id || null,
    ...DEFAULT_SETTINGS,
    created_at: '',
    updated_at: '',
  };

  return {
    settings: effectiveSettings,
    isLoading,
    updateSettings,
  };
}
