import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';

const emailSchema = z.string().email('Email invalide');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');

type AuthMode = 'login' | 'forgot' | 'reset';

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  
  const { signIn, user, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthFlow = async () => {
      const modeParam = searchParams.get('mode');
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setMode('reset');
          setIsCheckingSession(false);
        } else if (event === 'SIGNED_IN' && modeParam === 'reset') {
          setMode('reset');
          setIsCheckingSession(false);
        }
      });
      
      if (modeParam === 'reset') {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setMode('reset');
        } else {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const type = hashParams.get('type');
          
          if (!accessToken && type !== 'recovery') {
            toast({
              title: 'Lien expiré',
              description: 'Le lien de réinitialisation a expiré. Veuillez en demander un nouveau.',
              variant: 'destructive',
            });
            setMode('forgot');
          }
        }
      }
      
      setIsCheckingSession(false);
      
      return () => subscription.unsubscribe();
    };

    handleAuthFlow();
  }, [searchParams, toast]);

  useEffect(() => {
    if (user && mode !== 'reset' && !isCheckingSession) {
      navigate('/dashboard');
    }
  }, [user, navigate, mode, isCheckingSession]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; confirmPassword?: string } = {};
    
    if (mode !== 'reset') {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }
    }
    
    if (mode === 'login') {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }

    if (mode === 'reset') {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Erreur de connexion',
              description: 'Email ou mot de passe incorrect',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Erreur',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Connexion réussie',
            description: 'Bienvenue sur qashflow !',
          });
        }
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          toast({
            title: 'Erreur',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Email envoyé',
            description: 'Consultez votre boîte mail pour réinitialiser votre mot de passe.',
          });
          setMode('login');
        }
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          toast({
            title: 'Erreur',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Mot de passe mis à jour',
            description: 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
          });
          navigate('/dashboard');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Bon retour !';
      case 'forgot': return 'Mot de passe oublié';
      case 'reset': return 'Nouveau mot de passe';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Connectez-vous pour accéder à votre trésorerie';
      case 'forgot': return 'Entrez votre email pour recevoir un lien de réinitialisation';
      case 'reset': return 'Choisissez un nouveau mot de passe sécurisé';
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case 'login': return 'Se connecter';
      case 'forgot': return 'Envoyer le lien';
      case 'reset': return 'Mettre à jour';
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md text-primary-foreground"
        >
          <div className="mb-8">
            <img src={logo} alt="Qashflow" className="h-10" />
          </div>
          
          <h2 className="text-4xl font-bold leading-tight mb-6">
            Anticipez. Décidez. Dormez tranquille.
          </h2>
          
          <p className="text-lg opacity-90 mb-8">
            La solution tout-en-un pour piloter votre trésorerie et créer des business plans professionnels.
          </p>
          
          <div className="space-y-4">
            {['Synchronisation bancaire automatique', 'Catégorisation IA intelligente', 'Business Plan multi-scénarios'].map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span>{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={logo} alt="Qashflow" className="h-9" />
          </div>

          {/* Back button for forgot/reset modes */}
          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </button>
          )}

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              {getTitle()}
            </h2>
            <p className="text-muted-foreground mt-2">
              {getSubtitle()}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode !== 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="vous@entreprise.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
            )}

            {(mode === 'login' || mode === 'reset') && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  {mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: undefined });
                    }}
                    className={`pl-10 pr-10 ${errors.password ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>
            )}

            {mode === 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                    }}
                    className={`pl-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full gradient-primary h-12 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                getButtonText()
              )}
            </Button>
          </form>

          {mode === 'login' && (
            <p className="text-center text-muted-foreground mt-6">
              Pas encore de compte ?{' '}
              <Link to="/sign-up" className="text-primary hover:underline font-medium">
                Créer un compte
              </Link>
            </p>
          )}

          <p className="text-center text-muted-foreground mt-6 text-xs">
            <Link to="/" className="hover:underline">
              ← Retour à l'accueil
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
