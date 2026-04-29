import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

type AppRole = 'owner' | 'admin' | 'member' | 'viewer' | 'superadmin';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  max_companies: number;
  max_members: number;
  max_transactions_per_month: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

// Sensitive billing fields are NOT included on Organization. They are
// fetched on-demand via the `get_organization_billing` RPC, which enforces
// admin/owner access at the database level.
export interface OrganizationBilling {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_name: string | null;
  billing_email: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: AppRole;
  invited_email: string | null;
  joined_at: string | null;
  created_at: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  members: OrganizationMember[];
  userRole: AppRole | null;
  loading: boolean;
  setCurrentOrganization: (org: Organization) => void;
  updateOrganization: (id: string, updates: Partial<Organization>) => Promise<void>;
  inviteMember: (email: string, role: AppRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: AppRole) => Promise<void>;
  refetch: () => Promise<void>;
  isOwner: boolean;
  isAdmin: boolean;
  canManageMembers: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrganizationState(null);
      setLoading(false);
      return;
    }

    try {
      // Fetch organizations where user is a member
      const { data: membershipData, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;

      if (!membershipData || membershipData.length === 0) {
        setOrganizations([]);
        setCurrentOrganizationState(null);
        setLoading(false);
        return;
      }

      const orgIds = membershipData.map(m => m.organization_id);
      
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name, slug, owner_id, plan, subscription_status, trial_ends_at, max_companies, max_members, max_transactions_per_month, is_demo, created_at, updated_at')
        .in('id', orgIds)
        .is('deleted_at', null); // Filter out soft-deleted organizations

      if (orgsError) throw orgsError;

      setOrganizations(orgsData || []);

      // Set current organization from localStorage or first one
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      const savedOrg = orgsData?.find(o => o.id === savedOrgId);
      const orgToSet = savedOrg || orgsData?.[0] || null;
      
      if (orgToSet) {
        setCurrentOrganizationState(orgToSet);
        const membership = membershipData.find(m => m.organization_id === orgToSet.id);
        setUserRole(membership?.role as AppRole || null);
      }
    } catch (error) {
      logError('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!currentOrganization) {
      setMembers([]);
      return;
    }

    try {
      // Use the secure view that masks emails for non-admin members
      const { data, error } = await supabase
        .from('organization_members_safe')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      logError('Error fetching members:', error);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  useEffect(() => {
    fetchMembers();
  }, [currentOrganization]);

  const setCurrentOrganization = (org: Organization) => {
    setCurrentOrganizationState(org);
    localStorage.setItem('currentOrganizationId', org.id);
    
    // Update user role for this org
    const membership = members.find(m => m.organization_id === org.id && m.user_id === user?.id);
    setUserRole(membership?.role as AppRole || null);
  };

  const updateOrganization = async (id: string, updates: Partial<Organization>) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Organisation mise à jour');
      await fetchOrganizations();
    } catch (error) {
      logError('Error updating organization:', error);
      toast.error('Erreur lors de la mise à jour');
      throw error;
    }
  };

  const inviteMember = async (email: string, role: AppRole) => {
    if (!currentOrganization) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .insert({
          organization_id: currentOrganization.id,
          user_id: user?.id, // Temporary - will be updated when user accepts
          role,
          invited_email: email,
          invited_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      toast.success(`Invitation envoyée à ${email}`);
      await fetchMembers();
    } catch (error) {
      logError('Error inviting member:', error);
      toast.error('Erreur lors de l\'invitation');
      throw error;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      
      toast.success('Membre supprimé');
      await fetchMembers();
    } catch (error) {
      logError('Error removing member:', error);
      toast.error('Erreur lors de la suppression');
      throw error;
    }
  };

  const updateMemberRole = async (memberId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
      
      toast.success('Rôle mis à jour');
      await fetchMembers();
    } catch (error) {
      logError('Error updating member role:', error);
      toast.error('Erreur lors de la mise à jour');
      throw error;
    }
  };

  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const canManageMembers = isAdmin;

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        members,
        userRole,
        loading,
        setCurrentOrganization,
        updateOrganization,
        inviteMember,
        removeMember,
        updateMemberRole,
        refetch: fetchOrganizations,
        isOwner,
        isAdmin,
        canManageMembers,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
