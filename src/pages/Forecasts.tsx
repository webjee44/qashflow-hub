import { PageHeader } from '@/components/layout/PageHeader';
import { ForecastTable } from '@/components/forecasts/ForecastTable';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';

export default function Forecasts() {
  return (
    <>
      <OnboardingTour />
      <div className="space-y-8" data-tour="forecasts">
        <PageHeader 
          title="Prévisions" 
          subtitle="Gérez vos projections de trésorerie par catégorie et par mois" 
        />
        <ForecastTable />
      </div>
    </>
  );
}
