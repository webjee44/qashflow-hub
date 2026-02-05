import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ForecastTable } from '@/components/forecasts/ForecastTable';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { BPImportDialog } from '@/components/forecasts/BPImportDialog';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import { PageLoader } from '@/components/ui/page-loader';

export default function Forecasts() {
  const [importOpen, setImportOpen] = useState(false);
  const { currentCompany, isLoading: companyLoading } = useCompany();

  // Wait for company context to be ready before rendering ForecastTable
  if (companyLoading || !currentCompany) {
    return <PageLoader />;
  }

  return (
    <>
      <OnboardingTour />
      <div className="space-y-8" data-tour="forecasts">
        <PageHeader 
          title="Prévisions" 
          subtitle="Gérez vos projections de trésorerie par catégorie et par mois"
          actions={
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setImportOpen(true)}
              className="gap-2"
            >
              <FileDown className="w-4 h-4" />
              Import depuis BP
            </Button>
          }
        />
        {/* Key forces re-mount when company changes, ensuring fresh data fetch */}
        <ForecastTable key={currentCompany.id} />
      </div>
      
      {importOpen && <BPImportDialog open={importOpen} onOpenChange={setImportOpen} />}
    </>
  );
}
