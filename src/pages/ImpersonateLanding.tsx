import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle } from 'lucide-react';

/**
 * Landing page for impersonation flow.
 * This page handles the session switch after a magic link is clicked.
 * Supabase Auth redirects here with tokens in the URL hash.
 */
export default function ImpersonateLanding() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleSession = async () => {
      try {
        // Check if there are tokens in the URL hash (from magic link redirect)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        console.log('[Impersonate] Hash contains tokens:', !!accessToken);
        
        if (accessToken && refreshToken) {
          // Set the session using the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            console.error('[Impersonate] setSession error:', error);
            setErrorMsg(error.message);
            setStatus('error');
            return;
          }
          
          if (data.session?.user) {
            setUserEmail(data.session.user.email || null);
            setStatus('success');
            console.log('[Impersonate] Session established for:', data.session.user.email);
            
            // Clean the URL hash and redirect
            window.history.replaceState(null, '', window.location.pathname);
            
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1500);
            return;
          }
        }
        
        // If no tokens in hash, check for existing session (fallback)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Impersonate] getSession error:', sessionError);
          setErrorMsg(sessionError.message);
          setStatus('error');
          return;
        }
        
        if (session?.user) {
          setUserEmail(session.user.email || null);
          setStatus('success');
          console.log('[Impersonate] Existing session found for:', session.user.email);
          
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
        } else {
          console.error('[Impersonate] No session found and no tokens in URL');
          setErrorMsg('Aucun token trouvé dans l\'URL');
          setStatus('error');
        }
      } catch (err: any) {
        console.error('[Impersonate] Unexpected error:', err);
        setErrorMsg(err.message || 'Erreur inattendue');
        setStatus('error');
      }
    };

    handleSession();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Connexion en cours...</h1>
            <p className="text-muted-foreground">
              Établissement de la session d'usurpation
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
