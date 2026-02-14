import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle } from 'lucide-react';

/**
 * Landing page for impersonation flow.
 * Receives OTP token + email via query params and calls verifyOtp directly.
 * No redirect-based magic link flow — everything happens client-side.
 */
export default function ImpersonateLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleSession = async () => {
      try {
        const email = searchParams.get('email');
        const token = searchParams.get('token');
        const type = searchParams.get('type') || 'magiclink';

        if (!email || !token) {
          setErrorMsg('Paramètres manquants (email/token)');
          setStatus('error');
          return;
        }

        console.log('[Impersonate] Verifying OTP for:', email);

        // Sign out existing session first
        await supabase.auth.signOut({ scope: 'local' });
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify the OTP directly — no redirect needed
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: type as 'magiclink',
        });

        if (error) {
          console.error('[Impersonate] verifyOtp error:', error);
          setErrorMsg(error.message);
          setStatus('error');
          return;
        }

        if (data.session?.user) {
          setUserEmail(data.session.user.email || null);
          setStatus('success');
          console.log('[Impersonate] Session established for:', data.session.user.email);

          // Clean URL and redirect
          window.history.replaceState(null, '', '/impersonate-landing');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1200);
        } else {
          setErrorMsg('Session non créée');
          setStatus('error');
        }
      } catch (err: any) {
        console.error('[Impersonate] Unexpected error:', err);
        setErrorMsg(err.message || 'Erreur inattendue');
        setStatus('error');
      }
    };

    handleSession();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Connexion en cours...</h1>
            <p className="text-muted-foreground">
              Établissement de la session
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Connecté avec succès</h1>
            <p className="text-muted-foreground">
              Session active pour <span className="font-medium text-foreground">{userEmail}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Redirection vers le tableau de bord...
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-destructive text-2xl">!</span>
            </div>
            <h1 className="text-xl font-semibold mb-2">Erreur de connexion</h1>
            <p className="text-muted-foreground mb-2">
              Impossible d'établir la session.
            </p>
            {errorMsg && (
              <p className="text-xs text-muted-foreground mb-4 font-mono bg-muted p-2 rounded">
                {errorMsg}
              </p>
            )}
            <button
              onClick={() => window.close()}
              className="text-primary hover:underline"
            >
              Fermer cet onglet
            </button>
          </>
        )}
      </div>
    </div>
  );
}
