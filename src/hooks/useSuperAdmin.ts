import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { logError } from '@/lib/logger';
import { toast } from 'sonner';

interface GlobalStats {
  total_users: number;
  total_organizations: number;
  total_companies: number;
  total_business_plans: number;
  total_transactions: number;
}

export interface OrgStats {
  organization_id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string;
  owner_id: string;
  owner_email: string | null;
  created_at: string;
  max_members: number;
  max_companies: number;
  member_count: number;
  company_count: number;
  bp_count: number;
  is_demo: boolean;
  total_logins?: number;
  total_time_seconds?: number;
  last_active_at?: string | null;
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
      const { data, error } = await supabase.rpc('get_superadmin_org_stats_with_engagement');
      
      if (error) {
        logError('Error fetching org stats:', error);
        throw error;
      }

      return (data as OrgStats[]) || [];
    },
    enabled: !!isSuperAdmin,
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, mode }: { orgId: string; mode: 'soft' | 'permanent' }) => {
      if (mode === 'soft') {
        // Soft delete: set deleted_at
        const { error } = await supabase
          .from('organizations')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', orgId);
        if (error) {
          logError('Error soft-deleting organization:', error);
          throw error;
        }
      } else {
        // Permanent: get org members BEFORE deletion to invalidate their sessions after
        const { data: orgMembers } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', orgId);

        // Identify orphan users (only in this org) to delete their auth sessions
        const orphanUserIds: string[] = [];
        if (orgMembers && orgMembers.length > 0) {
          for (const member of orgMembers) {
            const { count } = await supabase
              .from('organization_members')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', member.user_id);
            if (count === 1) {
              orphanUserIds.push(member.user_id);
            }
          }
        }

        // Invalidate orphan users' sessions BEFORE cascade (users still exist in auth.users)
        for (const userId of orphanUserIds) {
          try {
            await supabase.functions.invoke('admin-delete-user', {
              body: { targetUserId: userId },
            });
          } catch (err) {
            logError('Error invalidating user session:', err);
          }
        }

        // Disconnect Bridge users
        const { data: companies } = await supabase
          .from('companies')
          .select('bridge_user_uuid')
          .eq('organization_id', orgId)
          .not('bridge_user_uuid', 'is', null);

        if (companies && companies.length > 0) {
          const uniqueUuids = [...new Set(companies.map(c => c.bridge_user_uuid).filter(Boolean))];
          for (const uuid of uniqueUuids) {
            try {
              await supabase.functions.invoke('admin-bridge-delete', {
                body: { bridge_user_uuid: uuid },
              });
            } catch (err) {
              logError('Error deleting Bridge user:', err);
            }
          }
        }

        // Cascade delete (deletes data + auth.users rows via SQL)
        const { error } = await supabase.rpc('delete_organization_cascade', { _org_id: orgId });
        if (error) {
          logError('Error deleting organization:', error);
          throw error;
        }
      }
    },
    onSuccess: (_, { mode }) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-org-stats'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-global-stats'] });
      toast.success(mode === 'soft' ? 'Organisation désactivée' : 'Organisation supprimée définitivement');
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    },
  });
}

export interface MemberStats {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  onboarding_completed: boolean;
  created_at: string;
  organizations: {
    org_id: string;
    org_name: string;
    role: string;
  }[];
  companies: {
    company_id: string;
    company_name: string;
    access_type: string;
  }[];
}

export function useSuperAdminAllMembers() {
  const { data: isSuperAdmin } = useSuperAdminRole();

  return useQuery({
    queryKey: ['superadmin-all-members'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_superadmin_all_members');
      
      if (error) {
        logError('Error fetching all members:', error);
        throw error;
      }

      return (data as unknown as MemberStats[]) || [];
    },
    enabled: !!isSuperAdmin,
  });
}
