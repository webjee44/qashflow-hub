// ============================================================
// useBPModel — single React Query hook
// ============================================================
// Fetches all BP inputs for the current company and runs the pure
// `computeBPModel` engine. All other BP hooks are selectors on top
// of this — single source of truth for screen + PDF.
// ============================================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useBPSettings } from '@/hooks/useBPSettings';
import { computeBPModel } from '../engine/computeBPModel';
import type { BPFinancialModel, BPModelInput } from '../engine/types';

const TABLES = [
  'bp_revenue_streams',
  'bp_fixed_expenses',
  'bp_variable_expenses',
  'bp_personnel',
  'bp_directors',
  'bp_investments',
  'bp_financings',
  'bp_stocks',
] as const;

export function useBPModel(): { data: BPFinancialModel | null; isLoading: boolean } {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { settings, isLoading: settingsLoading } = useBPSettings();
  const companyId = currentCompany?.id;

  const enabled = !!user && !!companyId;

  const queries = TABLES.map(table =>
    useQuery({
      queryKey: [table, companyId],
      queryFn: async () => {
        if (!companyId) return [];
        const { data, error } = await supabase
          .from(table as any)
          .select('*')
          .eq('company_id', companyId);
        if (error) throw error;
        return data || [];
      },
      enabled,
    })
  );

  const [streamsQ, fixedQ, variableQ, personnelQ, directorsQ, investmentsQ, financingsQ, stocksQ] = queries;
  const streams = (streamsQ.data as any[]) || [];
  const streamIds = streams.map(s => s.id);

  const forecastsQ = useQuery({
    queryKey: ['bp_revenue_forecasts_by_streams', streamIds],
    queryFn: async () => {
      if (streamIds.length === 0) return [];
      const { data, error } = await supabase
        .from('bp_revenue_forecasts')
        .select('*')
        .in('stream_id', streamIds);
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && streamIds.length > 0,
  });

  const isLoading =
    settingsLoading ||
    queries.some(q => q.isLoading) ||
    forecastsQ.isLoading;

  const data = useMemo<BPFinancialModel | null>(() => {
    if (!enabled || isLoading) return null;
    const input: BPModelInput = {
      settings,
      streams,
      forecasts: (forecastsQ.data as any[]) || [],
      fixedExpenses: (fixedQ.data as any[]) || [],
      variableExpenses: (variableQ.data as any[]) || [],
      personnel: (personnelQ.data as any[]) || [],
      directors: (directorsQ.data as any[]) || [],
      investments: (investmentsQ.data as any[]) || [],
      financings: (financingsQ.data as any[]) || [],
      stocks: (stocksQ.data as any[]) || [],
    };
    return computeBPModel(input);
  }, [
    enabled, isLoading, settings,
    streamsQ.data, fixedQ.data, variableQ.data, personnelQ.data,
    directorsQ.data, investmentsQ.data, financingsQ.data, stocksQ.data,
    forecastsQ.data,
  ]);

  return { data, isLoading };
}
