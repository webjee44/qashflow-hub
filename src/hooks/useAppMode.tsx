import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

type AppMode = 'treasury' | 'business-plan';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isTreasury: boolean;
  isBusinessPlan: boolean;
  syncModeWithPath: (pathname: string) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const STORAGE_KEY = 'pennyflow-app-mode';

function getModeFromPath(pathname: string): AppMode {
  if (pathname.startsWith('/bp')) {
    return 'business-plan';
  }
  return 'treasury';
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Default to business-plan for new users
    return (stored === 'treasury' ? 'treasury' : 'business-plan') as AppMode;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
  }, []);

  const syncModeWithPath = useCallback((pathname: string) => {
    const pathMode = getModeFromPath(pathname);
    if (pathMode !== mode) {
      setModeState(pathMode);
    }
  }, [mode]);

  return (
    <AppModeContext.Provider 
      value={{ 
        mode, 
        setMode,
        isTreasury: mode === 'treasury',
        isBusinessPlan: mode === 'business-plan',
        syncModeWithPath
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}

// Hook to auto-sync mode with current route
export function useAppModeSync() {
  const location = useLocation();
  const { syncModeWithPath } = useAppMode();

  useEffect(() => {
    syncModeWithPath(location.pathname);
  }, [location.pathname, syncModeWithPath]);
}
