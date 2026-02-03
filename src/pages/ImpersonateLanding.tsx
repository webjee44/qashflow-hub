import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle } from 'lucide-react';

/**
 * Landing page for impersonation flow.
 * This page handles the session switch after a magic link is clicked.
 * It ensures the new session is properly established before redirecting.
 */
export default function ImpersonateLanding() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const handleSession = async () => {
      try {
        // Wait a moment for the session to be established from the URL hash
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Impersonate] Session error:', error);
          setStatus('error');
          return;
        }
        
        if (session?.user) {
          setUserEmail(session.user.email || null);
          setStatus('success');
          
          console.log('[Impersonate] Session established for:', session.user.email);
          
          // Wait a moment to show success state, then redirect
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
        } else {
          console.error('[Impersonate] No session found');
          setStatus('error');
        }
      } catch (err) {
        console.error('[Impersonate] Unexpected error:', err);
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
            <p className="text-muted-foreground mb-4">
              Impossible d'établir la session. Le lien a peut-être expiré.
            </p>
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
