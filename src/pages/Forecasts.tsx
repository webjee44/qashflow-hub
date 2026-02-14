import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ForecastTable } from '@/components/forecasts/ForecastTable';
import { ForecastDemoBanner } from '@/components/forecasts/ForecastDemoBanner';
import { BPImportDialog } from '@/components/forecasts/BPImportDialog';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import { PageLoader } from '@/components/ui/page-loader';
import { supabase } from '@/integrations/supabase/client';

export default function Forecasts() {
  const [importOpen, setImportOpen] = useState(false);
  const { currentCompany, isLoading: companyLoading } = useCompany();
  const seedTriggered = useRef(false);

  // Auto-seed demo data if no forecasts exist
  useEffect(() => {
    if (!currentCompany?.id || seedTriggered.current) return;
    const companyId = currentCompany.id;
    const key = `forecast-demo-seeded-${companyId}`;
    if (localStorage.getItem(key)) return;

    seedTriggered.current = true;

    (async () => {
      // Check if any forecasts exist
      const { count } = await supabase
        .from('category_forecasts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);

      if ((count ?? 0) > 0) {
        localStorage.setItem(key, 'exists');
        return;
      }

      // Seed demo data
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.functions.invoke('seed-forecast-demo-data', {
          body: { company_id: companyId },
        });
        localStorage.setItem(key, 'seeded');
        // Force reload to show new data
        window.location.reload();
      } catch (err) {
        console.error('Failed to seed forecast demo data:', err);
      }
    })();
  }, [currentCompany?.id]);

  // Wait for company context to be ready before rendering ForecastTable
  if (companyLoading || !currentCompany) {
    return <PageLoader />;
  }

  return (
    <>
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
        <ForecastDemoBanner />
        {/* Key forces re-mount when company changes, ensuring fresh data fetch */}
        <ForecastTable key={currentCompany.id} />
      </div>
      
      {importOpen && <BPImportDialog open={importOpen} onOpenChange={setImportOpen} />}
    </>
  );
}
