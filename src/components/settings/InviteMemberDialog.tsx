import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useInvitations, getInvitationUrl, type InvitationRole, type Invitation } from '@/hooks/useInvitations';
import { useOrganization } from '@/hooks/useOrganization';
import { UserPlus, Copy, Check, Link, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const inviteSchema = z.object({
  email: z.string().email('Email invalide').min(1, 'L\'email est requis'),
  role: z.enum(['member'] as const),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

const roleLabels: Record<InvitationRole, string> = {
  owner: 'Propriétaire',
  admin: 'Membre',
  member: 'Membre',
  viewer: 'Membre',
};

const roleDescriptions: Record<string, string> = {
  member: 'Peut créer et modifier les données du Business Plan',
};

interface InviteMemberDialogProps {
  trigger?: React.ReactNode;
}

export function InviteMemberDialog({ trigger }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [generatedInvitation, setGeneratedInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  
  const { currentOrganization } = useOrganization();
  const { createInvitation } = useInvitations(currentOrganization?.id);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  });

  const onSubmit = async (values: InviteFormValues) => {
    if (!currentOrganization) return;

    try {
      const invitation = await createInvitation.mutateAsync({
        organization_id: currentOrganization.id,
        email: values.email,
        role: values.role,
      });
      
      setGeneratedInvitation(invitation);
    } catch (error) {
      // Error already handled in the hook
    }
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Inviter un membre
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Inviter un membre
          </DialogTitle>
          <DialogDescription>
            Envoyez un lien d'invitation pour rejoindre {currentOrganization?.name}
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="membre@exemple.com"
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

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createInvitation.isPending}>
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
                Partagez ce lien avec la personne que vous souhaitez inviter
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
