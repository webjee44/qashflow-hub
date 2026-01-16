import { motion } from 'framer-motion';
import { FundingPlanTable } from '@/components/businessplan/FundingPlanTable';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FundingPlan() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Plan de financement</h1>
          <p className="text-muted-foreground mt-1">
            Équilibre entre besoins et ressources sur la durée du business plan
          </p>
        </div>
        <BPExportDialog 
          trigger={
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exporter
            </Button>
          }
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <FundingPlanTable />
      </motion.div>

      <SectionNotes 
        section="funding_plan" 
        title="Notes sur le financement"
        placeholder="Décrivez votre stratégie de financement, les garanties prévues, les conditions des emprunts..."
      />
    </div>
  );
}
