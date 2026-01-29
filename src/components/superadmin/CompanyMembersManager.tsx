import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Trash2, Users, Loader2, Mail, Link2, Copy, Check, Clock, X } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getInvitationUrl, InvitationRole } from '@/hooks/useInvitations';

interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  email: string;
  invited_by: string | null;
  created_at: string;
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

export function CompanyMembersManager({ company, ownerEmail, organizationId }: CompanyMembersManagerProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Fetch company members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['company-members', company.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_company_members_with_email', {
        _company_id: company.id,
      });
      if (error) throw error;
      return (data || []) as CompanyMember[];
    },
  });

  // Fetch pending invitations for this company
  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ['pending-invitations', company.id, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .contains('company_ids', [company.id])
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Revoke invitation mutation
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
      queryClient.invalidateQueries({ queryKey: ['pending-invitations', company.id, organizationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la révocation');
    },
  });

  // Create invitation mutation
  const createInvitation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('Organization ID requis');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: organizationId,
          email: email.toLowerCase().trim(),
          role: role,
          company_ids: [company.id],
          invited_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const link = getInvitationUrl(data.token);
      setGeneratedLink(link);
      toast.success('Lien d\'invitation généré');
      queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création de l\'invitation');
    },
  });

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('company_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Membre retiré avec succès');
      queryClient.invalidateQueries({ queryKey: ['company-members', company.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  const handleCreateInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    createInvitation.mutate();
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Lien copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setIsInviting(false);
    setEmail('');
    setRole('member');
    setGeneratedLink(null);
    setCopied(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{company.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {members.length + 1} membre{members.length > 0 ? 's' : ''}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Gérer les accès utilisateurs à cette société
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Owner */}
        <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{ownerEmail || 'Propriétaire'}</span>
          </div>
          <Badge variant="default" className="text-xs">Propriétaire</Badge>
        </div>

        {/* Members list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : members.length > 0 ? (
          <div className="space-y-2">
            {members.map((member) => (
              <div 
                key={member.id} 
                className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{member.email}</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Retirer l'accès</AlertDialogTitle>
                      <AlertDialogDescription>
                        {member.email} n'aura plus accès à la société "{company.name}". 
                        Cette action est réversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeMember.mutate(member.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Retirer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        ) : null}

        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Invitations en attente</span>
            </div>
            {pendingInvitations.map((invitation: any) => (
              <div 
                key={invitation.id} 
                className="flex items-center justify-between py-2 px-3 bg-warning/10 border border-warning/20 rounded-md"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Mail className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-sm truncate">{invitation.email}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {invitation.role}
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => revokeInvitation.mutate(invitation.id)}
                  disabled={revokeInvitation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {isInviting ? (
          <div className="space-y-3">
            {generatedLink ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Lien d'invitation pour <strong>{email}</strong> :
                </p>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="flex-1 h-9 text-xs font-mono"
                  />
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="secondary"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="w-full"
                  onClick={handleReset}
                >
                  Nouvelle invitation
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvitation} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 h-9"
                    autoFocus
                  />
                  <Select value={role} onValueChange={(v) => setRole(v as InvitationRole)}>
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Lecteur</SelectItem>
                      <SelectItem value="member">Membre</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    size="sm" 
                    className="flex-1"
                    disabled={createInvitation.isPending || !email.trim()}
                  >
                    {createInvitation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Générer le lien
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={handleReset}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setIsInviting(true)}
            disabled={!organizationId}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Inviter un membre
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
