import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
  const [isCompleted, setIsCompleted] = useState(true); // Default to true to prevent auto-show
  const [bpEnabled, setBpEnabled] = useState(false);

  // Load onboarding state from profile
  useEffect(() => {
    async function loadOnboardingState() {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step, bp_enabled')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setIsCompleted(data.onboarding_completed ?? false);
        setCurrentStep(data.onboarding_step ?? 0);
        setBpEnabled(data.bp_enabled ?? false);

        // Auto-start tour if not completed
        if (!data.onboarding_completed) {
          setIsActive(true);
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

    setBpEnabled(true);
  }, [user]);

  const toggleBP = useCallback(async (enabled: boolean) => {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ bp_enabled: enabled })
      .eq('id', user.id);

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
    enableBP,
    toggleBP,
  };
}
