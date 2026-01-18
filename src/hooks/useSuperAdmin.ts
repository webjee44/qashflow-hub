import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { logError } from '@/lib/logger';

interface GlobalStats {
  total_users: number;
  total_organizations: number;
  total_companies: number;
  total_business_plans: number;
  total_transactions: number;
}

interface OrgStats {
  organization_id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string;
  owner_id: string;
  created_at: string;
  max_members: number;
  max_companies: number;
  member_count: number;
  company_count: number;
  bp_count: number;
  is_demo: boolean;
}

export function useSuperAdminRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['superadmin-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'superadmin')
        .maybeSingle();

      if (error) {
        logError('Error checking superadmin role:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user?.id,
  });
}

export function useSuperAdminGlobalStats() {
  const { data: isSuperAdmin } = useSuperAdminRole();

  return useQuery({
    queryKey: ['superadmin-global-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_superadmin_global_stats');
      
      if (error) {
        logError('Error fetching global stats:', error);
        throw error;
      }

      return (data?.[0] as GlobalStats) || null;
    },
    enabled: !!isSuperAdmin,
  });
}

export function useSuperAdminOrgStats() {
  const { data: isSuperAdmin } = useSuperAdminRole();

  return useQuery({
    queryKey: ['superadmin-org-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_superadmin_org_stats');
      
      if (error) {
        logError('Error fetching org stats:', error);
        throw error;
      }

      return (data as OrgStats[]) || [];
    },
    enabled: !!isSuperAdmin,
  });
}
