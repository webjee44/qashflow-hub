import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Copy, Check, Link, Mail, Loader2, Building2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const inviteSchema = z.object({
  email: z.string().email('Email invalide').min(1, 'L\'email est requis'),
  role: z.enum(['member'] as const),
  company_ids: z.array(z.string()).min(1, 'Sélectionnez au moins une société'),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface Company {
  id: string;
  name: string;
}

interface Invitation {
  id: string;
  token: string;
  email: string;
  role: AppRole;
  expires_at: string;
  company_ids: string[] | null;
}

const roleLabels: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Membre',
  member: 'Membre',
  viewer: 'Membre',
};

const roleDescriptions: Record<string, string> = {
  member: 'Peut créer et modifier les données du Business Plan',
};

interface SuperAdminInviteDialogProps {
  organizationId: string;
  organizationName: string;
  trigger?: React.ReactNode;
}

export function SuperAdminInviteDialog({ organizationId, organizationName, trigger }: SuperAdminInviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [generatedInvitation, setGeneratedInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Fetch organization companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['superadmin-org-companies', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_superadmin_org_companies', {
        _org_id: organizationId,
      });
      if (error) throw error;
      return (data || []) as Company[];
    },
    enabled: open && !!organizationId,
  });

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'member',
      company_ids: [],
    },
  });

  const createInvitation = useMutation({
    mutationFn: async (params: InviteFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: organizationId,
          email: params.email.toLowerCase().trim(),
          role: params.role,
          company_ids: params.company_ids,
          invited_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Invitation;
    },
    onSuccess: (data) => {
      toast.success('Invitation créée avec succès');
      setGeneratedInvitation(data);
      queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création de l\'invitation');
    },
  });

  const onSubmit = async (values: InviteFormValues) => {
    createInvitation.mutate(values);
  };

  const getInvitationUrl = (token: string): string => {
    return `https://qashflow.io/join?token=${token}`;
  };

  const copyLink = async () => {
    if (!generatedInvitation) return;
    
    const url = getInvitationUrl(generatedInvitation.token);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Lien copié dans le presse-papier');
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    setGeneratedInvitation(null);
    setCopied(false);
    form.reset();
  };

  // Get company names for display in success message
  const getSelectedCompanyNames = (companyIds: string[] | null): string => {
    if (!companyIds || companyIds.length === 0) return '';
    return companyIds
      .map(id => companies.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Link className="h-4 w-4 mr-2" />
            Créer un lien d'invitation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Inviter un nouveau membre
          </DialogTitle>
          <DialogDescription>
            Générez un lien d'inscription pour rejoindre {organizationName}
          </DialogDescription>
        </DialogHeader>

        {!generatedInvitation ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email du futur membre</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="nouveau@exemple.com"
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Role is always 'member' - hidden field */}
              <input type="hidden" {...form.register('role')} value="member" />
              
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-medium">Rôle : Membre</p>
                <p className="text-xs text-muted-foreground">{roleDescriptions.member}</p>
              </div>

              {/* Company selection */}
              <FormField
                control={form.control}
                name="company_ids"
                render={() => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Accès aux sociétés
                    </FormLabel>
                    {companiesLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement des sociétés...
                      </div>
                    ) : companies.length === 0 ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        Aucune société dans cette organisation
                      </div>
                    ) : (
                      <div className="rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto">
                        {companies.map((company) => (
                          <FormField
                            key={company.id}
                            control={form.control}
                            name="company_ids"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(company.id)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValue, company.id]);
                                      } else {
                                        field.onChange(currentValue.filter((id) => id !== company.id));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <Label className="text-sm font-normal cursor-pointer">
                                  {company.name}
                                </Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createInvitation.isPending || companies.length === 0}>
                  {createInvitation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      Générer le lien
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{generatedInvitation.email}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Rôle : <span className="font-medium text-foreground">{roleLabels[generatedInvitation.role]}</span>
              </div>
              {generatedInvitation.company_ids && generatedInvitation.company_ids.length > 0 && (
                <div className="text-sm text-muted-foreground flex items-start gap-2">
                  <Building2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Sociétés : <span className="font-medium text-foreground">{getSelectedCompanyNames(generatedInvitation.company_ids)}</span>
                  </span>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Expire le {new Date(generatedInvitation.expires_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lien d'invitation</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={getInvitationUrl(generatedInvitation.token)}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Le membre pourra s'inscrire via ce lien et aura accès directement aux sociétés sélectionnées.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Fermer
              </Button>
              <Button onClick={() => {
                setGeneratedInvitation(null);
                form.reset();
              }}>
                Nouvelle invitation
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
