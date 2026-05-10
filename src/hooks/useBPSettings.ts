import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { logError } from '@/lib/logger';
import { buildFiscalYears } from '@/features/business-plan/engine/buildFiscalYears';

export interface BPSettings {
  id: string;
  user_id: string;
  company_id: string | null;
  initial_cash: number;
  /** PR 2 — Capital social explicite. Null tant que non saisi. */
  initial_capital: number | null;
  customer_payment_delay: number;
  supplier_payment_delay: number;
  projection_months: number;
  tax_regime: string;
  is_pme: boolean;
  fiscal_year_start_month: number;
  fiscal_year_start_day: number;
  bp_start_date: string | null;
  bp_years: number;
  first_fiscal_year_end_date: string | null;
  show_stocks: boolean;
  show_financing: boolean;
  show_funding_plan: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS = {
  initial_cash: 0,
  initial_capital: null as number | null,
  customer_payment_delay: 30,
  supplier_payment_delay: 30,
  projection_months: 24,
  tax_regime: 'is',
  is_pme: true,
  fiscal_year_start_month: 1,
  fiscal_year_start_day: 1,
  bp_start_date: null,
  bp_years: 3,
  first_fiscal_year_end_date: null,
  show_stocks: true,
  show_financing: true,
  show_funding_plan: true,
};

export function useBPSettings() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only company owners can auto-create settings
  const isCompanyOwner = currentCompany?.user_id === user?.id;
  // BP settings are treated as company-level settings (owned by the company owner)
  const settingsOwnerId = currentCompany?.user_id;

  // Fetch settings - ALWAYS filter by company_id when available
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['bp_settings', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !settingsOwnerId) {
        return null;
      }
      
      const { data, error } = await supabase
        .from('bp_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('user_id', settingsOwnerId)
        .maybeSingle();
        
      if (error) throw error;
      return data as BPSettings | null;
    },
    enabled: !!user && !!currentCompany?.id && !!settingsOwnerId,
  });

  // Initialize default settings if none exist - ONLY for company owners
  useEffect(() => {
    const initDefaults = async () => {
      // Only owners can create settings automatically
      if (!user || isLoading || settings || !isCompanyOwner) return;

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
        logError('Error initializing BP settings:', err);
      }
    };

    initDefaults();
  }, [user, currentCompany?.id, isLoading, settings, refetch, isCompanyOwner]);

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (data: Partial<BPSettings>) => {
      if (!user) throw new Error('Not authenticated');
      if (!currentCompany?.id) throw new Error('No company selected');
      if (!settingsOwnerId) throw new Error('Company owner not found');
      if (!isCompanyOwner) throw new Error('Seul le propriétaire de la société peut modifier ces paramètres');

      // Use upsert to handle both create and update cases atomically
      const { error } = await supabase
        .from('bp_settings')
        .upsert({
          // If we have an existing settings id, include it for update
          ...(settings?.id ? { id: settings.id } : {}),
          user_id: settingsOwnerId,
          company_id: currentCompany.id,
          ...DEFAULT_SETTINGS,
          ...data,
        }, {
          onConflict: 'user_id,company_id',
          ignoreDuplicates: false
        });

      if (error) throw error;
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

  // Helper to get fiscal year dates — uses shared engine helper for consistency
  const getFiscalYears = () => {
    const startDate = effectiveSettings.bp_start_date
      ? new Date(effectiveSettings.bp_start_date)
      : new Date();
    const fiscalYears = buildFiscalYears({
      bpStartDate: startDate,
      bpYears: effectiveSettings.bp_years,
      fiscalYearStartMonth: effectiveSettings.fiscal_year_start_month,
      fiscalYearStartDay: effectiveSettings.fiscal_year_start_day,
      firstFiscalYearEndDate: effectiveSettings.first_fiscal_year_end_date
        ? new Date(effectiveSettings.first_fiscal_year_end_date)
        : null,
    });
    return fiscalYears.map(fy => ({
      start: fy.start,
      end: fy.end,
      label: fy.label,
      months: fy.months,
      monthCount: fy.monthCount,
      isLongFirstYear: fy.isLongFirstYear,
    }));
  };

  return {
    settings: effectiveSettings,
    isLoading,
    updateSettings,
    getFiscalYears,
  };
}
