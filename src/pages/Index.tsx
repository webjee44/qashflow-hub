import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import Dashboard from './Dashboard';
import Transactions from './Transactions';
import Forecasts from './Forecasts';
import Automations from './Automations';
import { motion, AnimatePresence } from 'framer-motion';

const Index = () => {
  const [currentPath, setCurrentPath] = useState('/');

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <Dashboard />;
      case '/transactions':
        return <Transactions />;
      case '/forecasts':
        return <Forecasts />;
      case '/automations':
        return <Automations />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar currentPath={currentPath} onNavigate={setCurrentPath} />
      
      <main className="ml-64 p-8 min-h-screen transition-all duration-300">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPath}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
