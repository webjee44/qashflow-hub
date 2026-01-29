import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Users, Loader2, Mail, Crown, Shield, Eye, User } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface CompanyAccess {
  company_id: string;
  company_name: string;
  has_access: boolean;
  is_owner: boolean;
}

interface OrgMember {
  member_id: string;
  user_id: string;
  email: string;
  role: AppRole;
  joined_at: string | null;
  companies: CompanyAccess[];
}

interface Company {
  id: string;
  name: string;
  user_id: string;
}

interface CompanyMembersManagerProps {
  company: Company;
  ownerEmail?: string;
  organizationId?: string;
}

const roleLabels: Record<AppRole, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
  viewer: 'Lecteur',
  superadmin: 'Super Admin',
};

const RoleIcon = ({ role }: { role: AppRole }) => {
  switch (role) {
    case 'owner':
      return <Crown className="h-3 w-3" />;
    case 'admin':
      return <Shield className="h-3 w-3" />;
    case 'viewer':
      return <Eye className="h-3 w-3" />;
    default:
      return <User className="h-3 w-3" />;
  }
};

export function CompanyMembersManager({ company, ownerEmail, organizationId }: CompanyMembersManagerProps) {
  const queryClient = useQueryClient();

  // Fetch all org members with their company access
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members-with-access', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase.rpc('get_org_members_with_company_access', {
        _org_id: organizationId,
      });
      if (error) throw error;
      // Parse companies JSON from the RPC response
      return (data || []).map((m) => ({
        ...m,
        companies: (m.companies as unknown as CompanyAccess[]) || [],
      })) as OrgMember[];
    },
    enabled: !!organizationId,
  });

  // Toggle company access mutation
  const toggleAccess = useMutation({
    mutationFn: async ({ userId, enable }: { userId: string; enable: boolean }) => {
      const { error } = await supabase.rpc('toggle_company_member_access', {
        _company_id: company.id,
        _user_id: userId,
        _enable: enable,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-with-access', organizationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Get access info for this company per member
  const getMemberCompanyAccess = (member: OrgMember) => {
    const companyAccess = member.companies?.find(c => c.company_id === company.id);
    return {
      hasAccess: companyAccess?.has_access || false,
      isOwner: companyAccess?.is_owner || company.user_id === member.user_id,
    };
  };

  // Count members with access
  const accessCount = members.filter(m => {
    const { hasAccess, isOwner } = getMemberCompanyAccess(m);
    return hasAccess || isOwner;
  }).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{company.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {accessCount} accès
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Toggle pour activer/désactiver l'accès
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aucun membre dans l'organisation
          </p>
        ) : (
          <div className="space-y-1">
            {members.map((member) => {
              const { hasAccess, isOwner } = getMemberCompanyAccess(member);
              
              return (
                <div 
                  key={member.user_id}
                  className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{member.email}</span>
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <RoleIcon role={member.role} />
                      {roleLabels[member.role]}
                    </span>
                  </div>
                  {isOwner ? (
                    <Badge variant="outline" className="text-xs shrink-0">
                      <Crown className="h-3 w-3 mr-1" />
                      Propriétaire
                    </Badge>
                  ) : (
                    <Switch
                      checked={hasAccess}
                      onCheckedChange={(checked) => 
                        toggleAccess.mutate({ userId: member.user_id, enable: checked })
                      }
                      disabled={toggleAccess.isPending}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
