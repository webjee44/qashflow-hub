import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type InvitationRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Invitation {
  id: string;
  organization_id: string;
  organization_name?: string;
  email: string;
  role: InvitationRole;
  company_ids: string[] | null;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface InvitationDetails {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role: InvitationRole;
  company_ids: string[] | null;
  expires_at: string;
  accepted_at: string | null;
}

export interface CreateInvitationParams {
  organization_id: string;
  email: string;
  role: InvitationRole;
  company_ids?: string[];
}

export function useInvitations(organizationId?: string) {
  const queryClient = useQueryClient();

  // Fetch invitations for an organization
  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
    },
    enabled: !!organizationId,
  });

  // Create a new invitation
  const createInvitation = useMutation({
    mutationFn: async (params: CreateInvitationParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: params.organization_id,
          email: params.email.toLowerCase().trim(),
          role: params.role,
          company_ids: params.company_ids || null,
          invited_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Invitation;
    },
    onSuccess: () => {
      toast.success('Invitation créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] });
    },
    onError: (error: Error) => {
      console.error('Error creating invitation:', error);
      toast.error(error.message || 'Erreur lors de la création de l\'invitation');
    },
  });

  // Revoke/delete an invitation
  const revokeInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('organization_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invitation révoquée');
      queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la révocation');
    },
  });

  return {
    invitations,
    isLoading,
    createInvitation,
    revokeInvitation,
  };
}

// Hook to get invitation details by token (for /join page)
export function useInvitationByToken(token: string | null) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .rpc('get_invitation_by_token', { _token: token });

      if (error) throw error;
      if (!data || data.length === 0) return null;
      
      return data[0] as InvitationDetails;
    },
    enabled: !!token,
    retry: false,
  });
}

// Hook to accept an invitation
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase
        .rpc('accept_invitation', { _token: token });

      if (error) throw error;
      
      const result = data as { success?: boolean; error?: string; organization_id?: string };
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success('Invitation acceptée ! Bienvenue dans l\'organisation.');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de l\'acceptation de l\'invitation');
    },
  });
}

// Helper to generate invitation URL - always use primary domain for public invitations
export function getInvitationUrl(token: string): string {
  // Use the primary domain for invitations
  const publishedUrl = 'https://qashflow.io';
  return `${publishedUrl}/join?token=${token}`;
}
