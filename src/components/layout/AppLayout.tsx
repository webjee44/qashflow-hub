import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { AppBreadcrumb } from './AppBreadcrumb';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';
import { DemoBanner } from './DemoBanner';
import { useAppModeSync } from '@/hooks/useAppMode';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader } from '@/components/ui/page-loader';
import { useActivityTracker } from '@/hooks/useActivityTracker';

// Widget de support - clé API publishable
const SUPPORT_WIDGET_API_KEY = '6304a129-c64a-42eb-b298-c04f46b23363';
const SUPPORT_WIDGET_COLOR = '#3b82f6';

export function AppLayout() {
  const { user } = useAuth();
  
  // Auto-sync mode with current route
  useAppModeSync();
  useActivityTracker();

  // Treasury is always accessible - no redirect needed

  // Charger le widget de support externe
  useEffect(() => {
    // Supprimer l'ancien script si présent
    const existingScript = document.getElementById('support-widget-script');
    if (existingScript) {
      existingScript.remove();
    }
    
    const script = document.createElement('script');
    script.id = 'support-widget-script';
    script.src = 'https://vqejzddudqixhuqcqeqy.supabase.co/functions/v1/widget';
    script.async = true;
    script.setAttribute('data-api-key', SUPPORT_WIDGET_API_KEY);
    script.setAttribute('data-color', SUPPORT_WIDGET_COLOR);
    script.setAttribute('data-position', 'bottom-right');
    
    // Pré-remplir l'email si l'utilisateur est connecté
    if (user?.email) {
      script.setAttribute('data-email', user.email);
    }
    
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById('support-widget-script');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [user?.email]);

  return (
    <div className="min-h-screen bg-background overflow-visible">
      <DemoBanner />
      <TrialExpiredBlocker />
      <Sidebar />
      
      <div className="ml-64 min-h-screen flex flex-col">
        <AppHeader />
        <AppBreadcrumb />
        
        <main className="flex-1 p-8 overflow-visible">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
