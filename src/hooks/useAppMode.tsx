import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type AppMode = 'treasury' | 'business-plan';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isTreasury: boolean;
  isBusinessPlan: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const STORAGE_KEY = 'pennyflow-app-mode';

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'business-plan' ? 'business-plan' : 'treasury') as AppMode;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
  };

  return (
    <AppModeContext.Provider 
      value={{ 
        mode, 
        setMode,
        isTreasury: mode === 'treasury',
        isBusinessPlan: mode === 'business-plan'
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
