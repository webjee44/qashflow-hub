import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ForecastTable, ForecastTableRef } from '@/components/forecasts/ForecastTable';

import { BPImportDialog } from '@/components/forecasts/BPImportDialog';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import { PageLoader } from '@/components/ui/page-loader';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/logger';
import { toast } from 'sonner';

export default function Forecasts() {
  const [importOpen, setImportOpen] = useState(false);
  const { currentCompany, isLoading: companyLoading } = useCompany();
  const seedTriggered = useRef(false);
  const tableRef = useRef<ForecastTableRef>(null);

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
        logError('Failed to seed forecast demo data:', err);
      }
    })();
  }, [currentCompany?.id]);

  const handleExport = async () => {
    try {
      await tableRef.current?.exportToExcel();
      toast.success('Export Excel généré avec succès');
    } catch (err) {
      logError('Export Excel failed:', err);
      toast.error("Erreur lors de l'export Excel");
    }
  };

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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExport}
                className="gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setImportOpen(true)}
                className="gap-2"
              >
                <FileDown className="w-4 h-4" />
                Import depuis BP
              </Button>
            </div>
          }
        />
        
        <ForecastTable key={currentCompany.id} ref={tableRef} />
      </div>
      
      {importOpen && <BPImportDialog open={importOpen} onOpenChange={setImportOpen} />}
    </>
  );
}
