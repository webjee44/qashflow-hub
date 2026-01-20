import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Trash2, Users, Loader2, Mail } from 'lucide-react';
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
}

export function CompanyMembersManager({ company, ownerEmail }: CompanyMembersManagerProps) {
  const [email, setEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
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

  // Add member mutation
  const addMember = useMutation({
    mutationFn: async (memberEmail: string) => {
      const { data, error } = await supabase.rpc('add_company_member_by_email', {
        _company_id: company.id,
        _email: memberEmail,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Membre ajouté avec succès');
      setEmail('');
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ['company-members', company.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de l\'ajout du membre');
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

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    addMember.mutate(email.trim());
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

        {/* Add member form */}
        {isAdding ? (
          <form onSubmit={handleAddMember} className="flex gap-2">
            <Input
              type="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-9"
              autoFocus
            />
            <Button 
              type="submit" 
              size="sm" 
              disabled={addMember.isPending || !email.trim()}
            >
              {addMember.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Ajouter'
              )}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setEmail('');
              }}
            >
              Annuler
            </Button>
          </form>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setIsAdding(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Ajouter un membre
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
