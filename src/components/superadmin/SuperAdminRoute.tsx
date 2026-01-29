import { ReactNode, useRef, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSuperAdminRole } from '@/hooks/useSuperAdmin';
import { Loader2, ShieldX } from 'lucide-react';

interface SuperAdminRouteProps {
  children: ReactNode;
}

export function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const { user, session, loading: authLoading } = useAuth();
  const { data: isSuperAdmin, isLoading: roleLoading, isFetched } = useSuperAdminRole();
  const location = useLocation();
  
  // Track if we've ever had a valid session to prevent redirect during token refresh
  const hadValidSession = useRef(false);
  
  useEffect(() => {
    if (session && isSuperAdmin) {
      hadValidSession.current = true;
    }
  }, [session, isSuperAdmin]);

  // During initial load OR if we previously had a valid session (token refresh scenario)
  const isInitializing = authLoading || roleLoading;
  const isTokenRefresh = hadValidSession.current && !session && !authLoading;
  
  if (isInitializing || isTokenRefresh) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  // Only redirect to auth if we never had a valid session AND loading is complete
  if (!user && !hadValidSession.current) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If role check is complete and user is not superadmin
  if (isFetched && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <ShieldX className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Accès refusé</h1>
          <p className="text-muted-foreground mb-6">
            Vous n'avez pas les droits nécessaires pour accéder à cette section.
          </p>
          <a href="/dashboard" className="text-primary hover:underline">
            Retour au tableau de bord
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
