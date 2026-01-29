import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { AppBreadcrumb } from './AppBreadcrumb';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';
import { DemoBanner } from './DemoBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppModeSync } from '@/hooks/useAppMode';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';

// Widget de support - clé API publishable
const SUPPORT_WIDGET_API_KEY = '6304a129-c64a-42eb-b298-c04f46b23363';
const SUPPORT_WIDGET_COLOR = '#3b82f6';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bpEnabled } = useOnboarding();
  
  // Auto-sync mode with current route
  useAppModeSync();

  // If the account is configured as "BP-only", prevent landing on Treasury routes
  // (otherwise the sidebar can appear empty: treasury items hidden + BP items hidden).
  useEffect(() => {
    if (!bpEnabled) return;

    const path = location.pathname;
    const isBusinessPlanRoute = path.startsWith('/bp');
    const isAllowedNonBPRoute = path === '/parametres' || path === '/aide';

    if (!isBusinessPlanRoute && !isAllowedNonBPRoute) {
      navigate('/bp/revenus', { replace: true });
    }
  }, [bpEnabled, location.pathname, navigate]);

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
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="overflow-visible"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
