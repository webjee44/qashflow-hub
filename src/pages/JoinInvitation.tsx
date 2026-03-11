import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvitationByToken, useAcceptInvitation, type InvitationRole } from '@/hooks/useInvitations';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';
import { Building2, Mail, Shield, User, Eye, Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import logo from '@/assets/logo.png';

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

const roleLabels: Record<InvitationRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  viewer: 'Lecteur',
};

const roleIcons: Record<InvitationRole, React.ReactNode> = {
  owner: <Shield className="h-4 w-4" />,
  admin: <Shield className="h-4 w-4" />,
  member: <User className="h-4 w-4" />,
  viewer: <Eye className="h-4 w-4" />,
};

export default function JoinInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const { user, loading: authLoading } = useAuth();
  const { data: invitation, isLoading: invitationLoading, error: invitationError } = useInvitationByToken(token);
  const acceptInvitation = useAcceptInvitation();
  
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      password: '',
      confirmPassword: '',
    },
  });

  // If user is logged in and invitation is valid, show accept button
  const canAcceptDirectly = user && invitation && !invitation.accepted_at;

  const handleAcceptInvitation = async () => {
    if (!token) return;
    
    try {
      await acceptInvitation.mutateAsync(token);
      // Default to Business Plan after joining (Treasury can still be accessed if enabled later)
      navigate('/previsions');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSignUp = async (values: SignUpFormValues) => {
    if (!invitation || !token) return;
    
    setIsSigningUp(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: invitation.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
            invitation_token: token,
          },
          // After email confirmation, land in Business Plan by default.
          emailRedirectTo: `${window.location.origin}/bp/revenus`,
        },
      });

      if (error) throw error;
      
      setSignUpSuccess(true);
      toast.success('Compte créé ! Vérifiez votre email pour confirmer.');
    } catch (error: any) {
      logError('Sign up error:', error);
      toast.error(error.message || 'Erreur lors de la création du compte');
    } finally {
      setIsSigningUp(false);
    }
  };

  // Loading state
  if (authLoading || invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // No token or invalid/expired invitation
  if (!token || invitationError || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Invitation invalide</CardTitle>
            <CardDescription>
              {!token 
                ? 'Aucun token d\'invitation fourni'
                : 'Cette invitation est invalide ou a expiré'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sign up success
  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Compte créé !</CardTitle>
            <CardDescription>
              Un email de confirmation a été envoyé à <strong>{invitation.email}</strong>.
              Cliquez sur le lien dans l'email pour activer votre compte et rejoindre {invitation.organization_name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild variant="outline" className="w-full">
              <Link to="/sign-in">Aller à la connexion</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={logo} alt="Qashflow" className="h-10 w-auto" />
          </div>
          <CardTitle>Rejoindre une organisation</CardTitle>
          <CardDescription>
            Vous avez été invité à rejoindre une organisation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation details */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{invitation.organization_name}</p>
                <p className="text-sm text-muted-foreground">Organisation</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{invitation.email}</span>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                {roleIcons[invitation.role]}
                {roleLabels[invitation.role]}
              </Badge>
            </div>
          </div>

          {/* Already logged in - just accept */}
          {canAcceptDirectly ? (
            <div className="space-y-4">
              {user.email?.toLowerCase() === invitation.email.toLowerCase() ? (
                <>
                  <p className="text-sm text-center text-muted-foreground">
                    Vous êtes connecté en tant que <strong>{user.email}</strong>
                  </p>
                  <Button 
                    onClick={handleAcceptInvitation} 
                    className="w-full"
                    disabled={acceptInvitation.isPending}
                  >
                    {acceptInvitation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Acceptation...
                      </>
                    ) : (
                      <>
                        Accepter l'invitation
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-destructive">
                    Vous êtes connecté en tant que <strong>{user.email}</strong>, mais l'invitation est pour <strong>{invitation.email}</strong>.
                  </p>
                  <Button variant="outline" onClick={() => supabase.auth.signOut()}>
                    Se déconnecter
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Not logged in - sign up form */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSignUp)} className="space-y-4">
                <div className="text-sm text-center text-muted-foreground mb-4">
                  Créez votre compte pour rejoindre l'organisation
                </div>
                
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{invitation.email}</p>
                </div>

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom complet</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jean Dupont" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmer le mot de passe</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSigningUp}>
                  {isSigningUp ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Création du compte...
                    </>
                  ) : (
                    'Créer mon compte et rejoindre'
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Vous avez déjà un compte ?{' '}
                  <Link to="/sign-in" className="text-primary hover:underline">
                    Connectez-vous
                  </Link>
                </p>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
