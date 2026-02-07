import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';

interface OnboardingStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard',
    target: '[data-tour="dashboard"]',
    title: 'Votre tableau de bord',
    description: 'Vue d\'ensemble de votre trésorerie en temps réel. Suivez vos entrées, sorties et solde actuel.',
    position: 'bottom',
  },
  {
    id: 'balance',
    target: '[data-tour="balance"]',
    title: 'Solde actuel',
    description: 'Votre solde bancaire synchronisé automatiquement. Les variations sont calculées sur 30 jours.',
    position: 'bottom',
  },
  {
    id: 'chart',
    target: '[data-tour="chart"]',
    title: 'Graphique de trésorerie',
    description: 'Visualisez l\'évolution de votre trésorerie sur les 30 derniers jours et anticipez les tendances.',
    position: 'top',
  },
  {
    id: 'transactions',
    target: '[data-tour="transactions"]',
    title: 'Dernières transactions',
    description: 'Toutes vos transactions sont importées automatiquement. Cliquez pour voir les détails.',
    position: 'left',
  },
  {
    id: 'categories',
    target: '[data-tour="categories"]',
    title: 'Catégories',
    description: 'Catégorisez vos flux pour mieux comprendre où va votre argent. L\'IA peut vous aider !',
    position: 'right',
  },
  {
    id: 'forecasts',
    target: '[data-tour="forecasts"]',
    title: 'Prévisions',
    description: 'Ajoutez vos factures récurrentes et visualisez votre trésorerie future.',
    position: 'right',
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Navigation',
    description: 'Accédez rapidement à toutes les fonctionnalités depuis la barre latérale.',
    position: 'right',
  },
  {
    id: 'company-selector',
    target: '[data-tour="company-selector"]',
    title: 'Sélecteur de société',
    description: 'Gérez plusieurs entreprises facilement. Passez de l\'une à l\'autre en un clic.',
    position: 'bottom',
  },
  {
    id: 'settings',
    target: '[data-tour="settings"]',
    title: 'Paramètres',
    description: 'Personnalisez votre expérience : catégories, exports, intégrations...',
    position: 'right',
  },
  {
    id: 'help',
    target: '[data-tour="help"]',
    title: 'Besoin d\'aide ?',
    description: 'Notre équipe est là pour vous accompagner. N\'hésitez pas à nous contacter !',
    position: 'bottom',
  },
];

// Shared bp_enabled state via localStorage + custom event.
// This avoids useSyncExternalStore (which is crashing in this environment) while
// still keeping Sidebar/Settings in sync.
const BP_ENABLED_STORAGE_KEY = 'bp_enabled';

function readStoredBpEnabled(): boolean {
  const raw = localStorage.getItem(BP_ENABLED_STORAGE_KEY);
  if (raw === null) return false; // default: Treasury enabled (both modules shown)
  return raw === 'true';
}

function writeStoredBpEnabled(value: boolean) {
  localStorage.setItem(BP_ENABLED_STORAGE_KEY, String(value));
  window.dispatchEvent(new Event('bp-enabled-changed'));
}


interface UseOnboardingReturn {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentStepData: OnboardingStep | null;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  isCompleted: boolean;
  bpEnabled: boolean;
  profileLoaded: boolean;
  enableBP: () => Promise<void>;
  toggleBP: (enabled: boolean) => Promise<void>;
}

export function useOnboarding(): UseOnboardingReturn {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [bpEnabled, setBpEnabled] = useState<boolean>(() => {
    // Guard in case localStorage isn't available yet
    try {
      return readStoredBpEnabled();
    } catch {
      return false; // default: Treasury enabled
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setBpEnabled(readStoredBpEnabled());
      } catch {
        // ignore
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === BP_ENABLED_STORAGE_KEY) sync();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('bp-enabled-changed', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bp-enabled-changed', sync);
    };
  }, []);

  // Load onboarding state from the user's OWN profile
  // Each user has their own bp_enabled preference, not inherited from company owner
  useEffect(() => {
    async function loadOnboardingState() {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step, bp_enabled')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('loadOnboardingState error', error);
        return;
      }

      if (data) {
        setIsCompleted(data.onboarding_completed ?? false);
        setCurrentStep(data.onboarding_step ?? 0);

        // bp_enabled can be used to configure a "BP-only" experience.
        // IMPORTANT: localStorage can contain stale values (e.g. from past experiments).
        // If the server says bp_enabled is false, we always reset localStorage to false to
        // avoid Treasury routes flashing then being redirected.
        const serverValue = data.bp_enabled ?? false;

        if (serverValue === false) {
          writeStoredBpEnabled(false);
          setBpEnabled(false);
        } else {
          // Only when BP-only is enabled server-side do we allow a local override (if any)
          // to keep sidebar/settings in sync without route flicker.
          const hasLocalChoice = localStorage.getItem(BP_ENABLED_STORAGE_KEY) !== null;
          if (!hasLocalChoice) {
            writeStoredBpEnabled(true);
            setBpEnabled(true);
          } else {
            setBpEnabled(readStoredBpEnabled());
          }
        }

        const shouldShowTour = localStorage.getItem('show-onboarding-tour') === 'true';
        if (shouldShowTour) {
          localStorage.removeItem('show-onboarding-tour');
          setIsActive(true);
          setCurrentStep(0);
        }
      }
      setProfileLoaded(true);
    }

    loadOnboardingState();
  }, [user]);

  const saveProgress = useCallback(async (step: number, completed: boolean = false) => {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        onboarding_step: step,
        onboarding_completed: completed,
      })
      .eq('id', user.id);
  }, [user]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    saveProgress(0);
  }, [saveProgress]);

  const nextStep = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      saveProgress(newStep);
    } else {
      completeTour();
    }
  }, [currentStep, saveProgress]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      saveProgress(newStep);
    }
  }, [currentStep, saveProgress]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setIsCompleted(true);
    saveProgress(0, true);
  }, [saveProgress]);

  const completeTour = useCallback(() => {
    setIsActive(false);
    setIsCompleted(true);
    saveProgress(ONBOARDING_STEPS.length, true);
  }, [saveProgress]);

  const enableBP = useCallback(async () => {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ bp_enabled: true })
      .eq('id', user.id);

    writeStoredBpEnabled(true);
    setBpEnabled(true);
  }, [user]);

  const toggleBP = useCallback(async (enabled: boolean) => {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ bp_enabled: enabled })
      .eq('id', user.id);

    writeStoredBpEnabled(enabled);
    setBpEnabled(enabled);
  }, [user]);

  return {
    isActive,
    currentStep,
    totalSteps: ONBOARDING_STEPS.length,
    currentStepData: ONBOARDING_STEPS[currentStep] || null,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    isCompleted,
    bpEnabled,
    profileLoaded,
    enableBP,
    toggleBP,
  };
}