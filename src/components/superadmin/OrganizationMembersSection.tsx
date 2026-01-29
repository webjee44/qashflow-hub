import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Users, Trash2, UserPlus, Loader2, Mail, Building2, Crown, Shield, Eye, User, Link } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { SuperAdminInviteDialog } from './SuperAdminInviteDialog';

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

interface OrganizationMembersSectionProps {
  organizationId: string;
  organizationName?: string;
}

const roleConfig: Record<AppRole, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: 'Propriétaire', icon: Crown, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  admin: { label: 'Admin', icon: Shield, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  member: { label: 'Membre', icon: User, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  viewer: { label: 'Lecteur', icon: Eye, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  superadmin: { label: 'Super Admin', icon: Crown, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
};

export function OrganizationMembersSection({ organizationId, organizationName }: OrganizationMembersSectionProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('member');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch org members with company access
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members-with-access', organizationId],
    queryFn: async () => {
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

  // Add member mutation
  const addMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      const { data, error } = await supabase.rpc('add_organization_member_by_email', {
        _org_id: organizationId,
        _email: email,
        _role: role,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; user_id?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erreur inconnue');
      }
      return result;
    },
    onSuccess: () => {
      toast.success('Membre ajouté avec succès');
      setEmail('');
      setRole('member');
      queryClient.invalidateQueries({ queryKey: ['org-members-with-access', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-org-stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_organization_member', {
        _org_id: organizationId,
        _user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Membre retiré avec succès');
      queryClient.invalidateQueries({ queryKey: ['org-members-with-access', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-org-stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle company access mutation
  const toggleAccess = useMutation({
    mutationFn: async ({ companyId, userId, enable }: { companyId: string; userId: string; enable: boolean }) => {
      const { error } = await supabase.rpc('toggle_company_member_access', {
        _company_id: companyId,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    addMember.mutate({ email: email.trim(), role });
  };

  const RoleIcon = ({ role }: { role: AppRole }) => {
    const config = roleConfig[role];
    const Icon = config.icon;
    return <Icon className="h-3 w-3" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Membres de l'organisation
        </CardTitle>
        <CardDescription>
          Gérez les membres et leurs accès aux sociétés
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite link button for new users */}
        <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/30">
          <div className="flex-1">
            <p className="text-sm font-medium">Inviter un nouveau membre</p>
            <p className="text-xs text-muted-foreground">Générez un lien d'invitation pour quelqu'un qui n'a pas encore de compte</p>
          </div>
          <SuperAdminInviteDialog 
            organizationId={organizationId} 
            organizationName={organizationName || 'cette organisation'}
          />
        </div>

        {/* Add existing member form */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Ou ajouter un utilisateur existant par email :</p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="email"
              placeholder="email@exemple.com (utilisateur existant)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Lecteur</SelectItem>
                <SelectItem value="member">Membre</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={addMember.isPending || !email.trim()}>
              {addMember.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>

        {/* Members list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun membre dans cette organisation
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const config = roleConfig[member.role];
              const isExpanded = expandedMember === member.user_id;
              const isOwner = member.role === 'owner';
              const companies = member.companies || [];

              return (
                <div
                  key={member.member_id}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Member header */}
                  <div 
                    className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{member.email}</span>
                      <Badge className={`${config.color} text-xs shrink-0`}>
                        <RoleIcon role={member.role} />
                        <span className="ml-1">{config.label}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {companies.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {companies.filter(c => c.has_access || c.is_owner).length}/{companies.length} sociétés
                        </span>
                      )}
                      {!isOwner && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {member.email} sera retiré de l'organisation et de toutes les sociétés.
                                Cette action peut être annulée en ré-ajoutant le membre.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeMember.mutate(member.user_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Retirer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>

                  {/* Company access toggles */}
                  {isExpanded && companies.length > 0 && (
                    <div className="p-3 space-y-2 border-t bg-background">
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mb-2">
                        <Building2 className="h-3 w-3" />
                        Accès aux sociétés
                      </p>
                      {companies.map((company) => (
                        <div 
                          key={company.company_id}
                          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
                        >
                          <span className="text-sm">{company.company_name}</span>
                          {company.is_owner ? (
                            <Badge variant="outline" className="text-xs">
                              Propriétaire
                            </Badge>
                          ) : (
                            <Switch
                              checked={company.has_access}
                              onCheckedChange={(checked) => 
                                toggleAccess.mutate({
                                  companyId: company.company_id,
                                  userId: member.user_id,
                                  enable: checked,
                                })
                              }
                              disabled={toggleAccess.isPending}
                            />
                          )}
                        </div>
                      ))}
                    </div>
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
