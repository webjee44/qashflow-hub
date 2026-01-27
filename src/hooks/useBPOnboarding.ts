import { useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CompanyContext } from './useCompany';
import { useNavigate } from 'react-router-dom';

export interface BPOnboardingStep {
  id: string;
  route: string;
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
}

export const BP_ONBOARDING_STEPS: BPOnboardingStep[] = [
  {
    id: 'bp-settings',
    route: '/bp/revenus',
    target: '[data-tour-bp="settings"]',
    title: 'Paramètres du Business Plan',
    description: 'Configurez la date de début, le nombre d\'années de projection et le régime fiscal de votre entreprise.',
    position: 'bottom',
    action: 'Ouvrez les paramètres BP',
  },
  {
    id: 'bp-revenue',
    route: '/bp/revenus',
    target: '[data-tour-bp="revenue-table"]',
    title: 'Vos sources de revenus',
    description: 'Définissez vos flux de revenus : produits, services, abonnements. Saisissez les montants mois par mois pour l\'année 1.',
    position: 'top',
  },
  {
    id: 'bp-revenue-add',
    route: '/bp/revenus',
    target: '[data-tour-bp="add-revenue"]',
    title: 'Ajouter un flux de revenus',
    description: 'Cliquez ici pour créer votre première source de revenus. Vous pouvez avoir plusieurs flux (produit A, produit B, services...).',
    position: 'left',
  },
  {
    id: 'bp-expenses',
    route: '/bp/charges',
    target: '[data-tour-bp="expenses-card"]',
    title: 'Vos charges fixes',
    description: 'Loyer, assurances, abonnements SaaS, comptabilité... Utilisez les templates pour démarrer rapidement !',
    position: 'top',
  },
  {
    id: 'bp-expenses-template',
    route: '/bp/charges',
    target: '[data-tour-bp="expense-template"]',
    title: 'Templates de charges',
    description: 'Choisissez un template adapté à votre activité (SaaS, commerce, conseil...) pour pré-remplir les charges courantes.',
    position: 'bottom',
  },
  {
    id: 'bp-team',
    route: '/bp/equipe',
    target: '[data-tour-bp="team-summary"]',
    title: 'Votre équipe',
    description: 'Ajoutez vos salariés, apprentis et freelances. Les charges sociales sont calculées automatiquement selon le statut.',
    position: 'top',
  },
  {
    id: 'bp-investments',
    route: '/bp/investissements',
    target: '[data-tour-bp="investments-card"]',
    title: 'Investissements',
    description: 'Matériel, véhicules, aménagements... Les amortissements sont calculés automatiquement sur la durée choisie.',
    position: 'top',
  },
  {
    id: 'bp-pnl',
    route: '/bp/pnl',
    target: '[data-tour-bp="pnl-summary"]',
    title: 'Compte de Résultat',
    description: 'Visualisez votre rentabilité prévisionnelle. Les données des années 2 et 3 sont projetées automatiquement.',
    position: 'top',
  },
  {
    id: 'bp-scenarios',
    route: '/bp/scenarios',
    target: '[data-tour-bp="scenarios-grid"]',
    title: 'Scénarios',
    description: '3 scénarios sont créés par défaut : Pessimiste, Réaliste, Optimiste. Ils se mettent à jour automatiquement !',
    position: 'top',
  },
];

interface UseBPOnboardingReturn {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentStepData: BPOnboardingStep | null;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  isCompleted: boolean;
  shouldShowWizard: boolean;
  dismissWizard: () => void;
  hasData: boolean;
}

export function useBPOnboarding(): UseBPOnboardingReturn {
  const { user } = useAuth();
  const companyContext = useContext(CompanyContext);
  const currentCompany = companyContext?.currentCompany ?? null;
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(true);
  const [shouldShowWizard, setShouldShowWizard] = useState(false);
  const [hasData, setHasData] = useState(false);

  // Check if user has any BP data
  useEffect(() => {
    async function checkBPData() {
      if (!user || !currentCompany?.id) return;

      const { data: streams } = await supabase
        .from('bp_revenue_streams')
        .select('id')
        .eq('company_id', currentCompany.id)
        .limit(1);

      const { data: expenses } = await supabase
        .from('bp_fixed_expenses')
        .select('id')
        .eq('company_id', currentCompany.id)
        .limit(1);

      const hasAnyData = (streams?.length || 0) > 0 || (expenses?.length || 0) > 0;
      setHasData(hasAnyData);

      // Show wizard if no data and not dismissed
      const wizardDismissed = localStorage.getItem(`bp-wizard-dismissed-${currentCompany.id}`);
      if (!hasAnyData && !wizardDismissed) {
        setShouldShowWizard(true);
      }
    }

    checkBPData();
  }, [user, currentCompany?.id]);

  // Check if tour should start
  useEffect(() => {
    const shouldShowTour = localStorage.getItem('show-bp-onboarding-tour') === 'true';
    if (shouldShowTour) {
      localStorage.removeItem('show-bp-onboarding-tour');
      setIsActive(true);
      setCurrentStep(0);
      setIsCompleted(false);
    }
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    setIsCompleted(false);
    // Navigate to first step's route
    navigate(BP_ONBOARDING_STEPS[0].route);
  }, [navigate]);

  const nextStep = useCallback(() => {
    if (currentStep < BP_ONBOARDING_STEPS.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      // Navigate to next step's route if different
      const nextRoute = BP_ONBOARDING_STEPS[newStep].route;
      if (nextRoute !== BP_ONBOARDING_STEPS[currentStep].route) {
        navigate(nextRoute);
      }
    } else {
      // Complete tour
      setIsActive(false);
      setIsCompleted(true);
    }
  }, [currentStep, navigate]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      // Navigate to previous step's route if different
      const prevRoute = BP_ONBOARDING_STEPS[newStep].route;
      if (prevRoute !== BP_ONBOARDING_STEPS[currentStep].route) {
        navigate(prevRoute);
      }
    }
  }, [currentStep, navigate]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setIsCompleted(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsActive(false);
    setIsCompleted(true);
  }, []);

  const dismissWizard = useCallback(() => {
    if (currentCompany?.id) {
      localStorage.setItem(`bp-wizard-dismissed-${currentCompany.id}`, 'true');
    }
    setShouldShowWizard(false);
  }, [currentCompany?.id]);

  return {
    isActive,
    currentStep,
    totalSteps: BP_ONBOARDING_STEPS.length,
    currentStepData: BP_ONBOARDING_STEPS[currentStep] || null,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    isCompleted,
    shouldShowWizard,
    dismissWizard,
    hasData,
  };
}
