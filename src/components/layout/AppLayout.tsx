import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { AppBreadcrumb } from './AppBreadcrumb';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppModeSync } from '@/hooks/useAppMode';

export function AppLayout() {
  const location = useLocation();
  
  // Auto-sync mode with current route
  useAppModeSync();

  return (
    <div className="min-h-screen bg-background overflow-visible">
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
