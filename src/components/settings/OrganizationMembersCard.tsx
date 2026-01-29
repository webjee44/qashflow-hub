import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useInvitations, getInvitationUrl, type InvitationRole } from '@/hooks/useInvitations';
import { InviteMemberDialog } from './InviteMemberDialog';
import { Users, Trash2, Crown, Shield, User, Eye, Clock, Copy, Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type AppRole = 'owner' | 'admin' | 'member' | 'viewer';

const roleLabels: Record<AppRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  viewer: 'Lecteur',
};

const roleIcons: Record<AppRole, React.ReactNode> = {
  owner: <Crown className="h-4 w-4 text-amber-500" />,
  admin: <Shield className="h-4 w-4 text-blue-500" />,
  member: <User className="h-4 w-4 text-primary" />,
  viewer: <Eye className="h-4 w-4 text-muted-foreground" />,
};

export const OrganizationMembersCard = () => {
  const { user } = useAuth();
  const { 
    currentOrganization, 
    members, 
    loading, 
    canManageMembers,
    removeMember,
    updateMemberRole,
  } = useOrganization();
  
  const { invitations, revokeInvitation } = useInvitations(currentOrganization?.id);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleRemove = async (memberId: string) => {
    await removeMember(memberId);
  };

  const handleRoleChange = async (memberId: string, newRole: AppRole) => {
    await updateMemberRole(memberId, newRole);
  };

  const copyInviteLink = async (token: string) => {
    const url = getInvitationUrl(token);
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success('Lien copié');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!currentOrganization) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Membres de l'équipe</CardTitle>
        </div>
        <CardDescription>
          Gérez les membres de votre organisation ({members.length}/{currentOrganization.max_members})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Button */}
        {canManageMembers && members.length < currentOrganization.max_members && (
          <InviteMemberDialog />
        )}

        {/* Members limit reached */}
        {members.length >= currentOrganization.max_members && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
            Limite de membres atteinte. Passez à un plan supérieur pour inviter plus de membres.
          </div>
        )}

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Invitations en attente ({invitations.length})
            </h4>
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-3 rounded-lg border border-dashed bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="border-2 border-dashed">
                    <AvatarFallback className="bg-transparent text-muted-foreground">
                      {getInitials(invitation.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-muted-foreground">
                        {invitation.email}
                      </span>
                      <Badge variant="outline" className="text-xs">En attente</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      {roleIcons[invitation.role as AppRole]}
                      <span>{roleLabels[invitation.role as AppRole]}</span>
                      <span className="text-xs ml-2">
                        Expire le {new Date(invitation.expires_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyInviteLink(invitation.token)}
                    title="Copier le lien"
                  >
                    {copiedToken === invitation.token ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Révoquer cette invitation ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          L'invitation pour {invitation.email} sera annulée et le lien ne fonctionnera plus.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => revokeInvitation.mutate(invitation.id)}>
                          Révoquer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Members List */}
        <div className="space-y-3">
          {invitations.length > 0 && (
            <h4 className="text-sm font-medium text-muted-foreground">
              Membres actifs ({members.length})
            </h4>
          )}
          {members.map((member) => {
            const isCurrentUser = member.user_id === user?.id;
            const isMemberOwner = member.role === 'owner';
            
            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(member.invited_email || member.user_id)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {member.invited_email || (isCurrentUser ? 'Vous' : 'Membre')}
                      </span>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">Vous</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      {roleIcons[member.role as AppRole]}
                      <span>{roleLabels[member.role as AppRole]}</span>
                    </div>
                  </div>
                </div>

                {canManageMembers && !isCurrentUser && !isMemberOwner && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleRoleChange(member.id, v as AppRole)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Membre</SelectItem>
                        <SelectItem value="viewer">Lecteur</SelectItem>
                      </SelectContent>
                    </Select>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce membre ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action retirera l'accès de ce membre à l'organisation.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemove(member.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
