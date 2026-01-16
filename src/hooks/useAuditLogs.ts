import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'RESTORE' | 'EXPORT';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  user_id: string | null;
  organization_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UseAuditLogsOptions {
  table_name?: string;
  action?: string;
  limit?: number;
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { currentOrganization } = useOrganization();
  const { table_name, action, limit = 100 } = options;

  const { data: logs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', currentOrganization?.id, table_name, action, limit],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (table_name) {
        query = query.eq('table_name', table_name);
      }

      if (action) {
        query = query.eq('action', action);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AuditLog[];
    },
    enabled: !!currentOrganization?.id,
  });

  return {
    logs,
    isLoading,
    error,
    refetch,
  };
}

// Helper to format action labels in French
export function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    INSERT: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
    SOFT_DELETE: 'Suppression',
    RESTORE: 'Restauration',
    EXPORT: 'Export',
  };
  return labels[action] || action;
}

// Helper to format table names in French
export function formatTableName(tableName: string): string {
  const names: Record<string, string> = {
    organizations: 'Organisation',
    companies: 'Société',
    transactions: 'Transaction',
    categories: 'Catégorie',
    forecasts: 'Prévision',
    bp_settings: 'Paramètres BP',
    bp_revenue_streams: 'Flux de revenus',
    bp_fixed_expenses: 'Charges fixes',
    bp_variable_expenses: 'Charges variables',
    bp_investments: 'Investissement',
    bp_financings: 'Financement',
    bp_personnel: 'Personnel',
    bp_directors: 'Dirigeant',
    EXPORT: 'Export de données',
  };
  return names[tableName] || tableName;
}