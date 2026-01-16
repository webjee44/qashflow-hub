import { motion } from 'framer-motion';
import { FundingPlanTable } from '@/components/businessplan/FundingPlanTable';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { PageHeader } from '@/components/layout/PageHeader';

export default function FundingPlan() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan de financement"
        subtitle="Équilibre entre besoins et ressources sur la durée du business plan"
        actions={<BPExportDialog />}
      />

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
