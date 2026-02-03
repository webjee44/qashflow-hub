import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.info('[Auth] Event:', event);
        
        // Update state synchronously
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        
        // Handle specific events
        if (event === 'TOKEN_REFRESHED') {
          console.info('[Auth] Token refreshed successfully');
        }
        
        if (event === 'SIGNED_OUT') {
          console.info('[Auth] User signed out');
          setSession(null);
          setUser(null);
        }
      }
    );

    // THEN check for existing session
    const initSession = async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth] Error getting session:', error);
          // Try to refresh the session if there's an error
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session) {
            setSession(refreshData.session);
            setUser(refreshData.session.user);
            console.info('[Auth] Session refreshed after error');
          }
          setLoading(false);
          return;
        }
        
        if (existingSession) {
          setSession(existingSession);
          setUser(existingSession.user);
          console.info('[Auth] Session restored');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('[Auth] Init error:', err);
        setLoading(false);
      }
    };
    
    initSession();

    // Refresh session periodically (every 10 minutes) to prevent expiration
    const refreshInterval = setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        const { data: refreshData, error } = await supabase.auth.refreshSession();
        if (!error && refreshData.session) {
          console.info('[Auth] Proactive session refresh');
        }
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Use local scope to reliably clear the browser session even if the server
    // no longer recognizes the JWT session (e.g. session_not_found).
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (err) {
      // Fallback: ensure we clear any persisted auth tokens so route guards
      // don't immediately treat the user as authenticated again.
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (/^sb-.*-auth-token$/.test(key)) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // ignore storage errors
      }

      // Re-throw so callers can log if needed
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
