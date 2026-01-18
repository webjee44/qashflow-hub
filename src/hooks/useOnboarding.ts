import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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

// Cross-component state store for bpEnabled.
// We mirror it into localStorage so ANY component instance (even after HMR reloads)
// reads the same value immediately.
const BP_ENABLED_STORAGE_KEY = 'bp_enabled';

let globalBpEnabled = true;
const listeners = new Set<() => void>();

function readStoredBpEnabled(): boolean {
  const raw = localStorage.getItem(BP_ENABLED_STORAGE_KEY);
  if (raw === null) return true; // default: BP only (Treasury hidden)
  return raw === 'true';
}

function subscribeToBpEnabled(callback: () => void) {
  listeners.add(callback);

  const onStorage = (e: StorageEvent) => {
    if (e.key === BP_ENABLED_STORAGE_KEY) callback();
  };

  const onCustom = () => callback();

  window.addEventListener('storage', onStorage);
  window.addEventListener('bp-enabled-changed', onCustom);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('bp-enabled-changed', onCustom);
  };
}

function getBpEnabledSnapshot() {
  // Always read from localStorage for consistency.
  globalBpEnabled = readStoredBpEnabled();
  return globalBpEnabled;
}

function setBpEnabledGlobal(value: boolean) {
  globalBpEnabled = value;
  localStorage.setItem(BP_ENABLED_STORAGE_KEY, String(value));
  // Notify in-tab subscribers
  window.dispatchEvent(new Event('bp-enabled-changed'));
  // Notify direct listeners (extra safety)
  listeners.forEach((listener) => listener());
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
  enableBP: () => Promise<void>;
  toggleBP: (enabled: boolean) => Promise<void>;
}

export function useOnboarding(): UseOnboardingReturn {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(true);

  // Use useSyncExternalStore for cross-component state sharing
  const bpEnabled = useSyncExternalStore(subscribeToBpEnabled, getBpEnabledSnapshot);

  // Load onboarding state from profile
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
        setBpEnabledGlobal(data.bp_enabled ?? true);

        const shouldShowTour = localStorage.getItem('show-onboarding-tour') === 'true';
        if (shouldShowTour) {
          localStorage.removeItem('show-onboarding-tour');
          setIsActive(true);
          setCurrentStep(0);
        }
      }
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

    setBpEnabledGlobal(true);
  }, [user]);

  const toggleBP = useCallback(async (enabled: boolean) => {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ bp_enabled: enabled })
      .eq('id', user.id);

    setBpEnabledGlobal(enabled);
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
    enableBP,
    toggleBP,
  };
}