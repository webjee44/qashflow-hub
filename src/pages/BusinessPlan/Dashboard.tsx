import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBusinessPlans, BusinessPlan } from '@/hooks/useBusinessPlans';
import { useCompany } from '@/hooks/useCompany';
import { BPCard } from '@/components/businessplan/BPCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function BPDashboard() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { businessPlans, isLoading, deleteBusinessPlan, duplicateBusinessPlan } = useBusinessPlans();
  const { toast } = useToast();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bpToDelete, setBpToDelete] = useState<BusinessPlan | null>(null);

  const hasBPs = businessPlans.length > 0;

  const handleCreate = () => {
    navigate('/bp/editor/new');
  };

  const handleView = (bp: BusinessPlan) => {
    navigate(`/bp/editor/${bp.id}`);
  };

  const handleEdit = (bp: BusinessPlan) => {
    navigate(`/bp/editor/${bp.id}`);
  };

  const handleDuplicate = async (bp: BusinessPlan) => {
    await duplicateBusinessPlan.mutateAsync(bp.id);
  };

  const handleDeleteClick = (bp: BusinessPlan) => {
    setBpToDelete(bp);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (bpToDelete) {
      await deleteBusinessPlan.mutateAsync(bpToDelete.id);
      setBpToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleDownload = (bp: BusinessPlan) => {
    toast({
      title: 'Export PDF',
      description: 'Fonctionnalité à venir',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <PageHeader
        title="Business Plans"
        subtitle={currentCompany?.name || 'Sélectionnez une société'}
        actions={
          <Button onClick={handleCreate} data-tour="new-bp">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Business Plan
          </Button>
        }
      />

      {hasBPs ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {businessPlans.map((bp) => (
            <BPCard
              key={bp.id}
              businessPlan={bp}
              onView={handleView}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteClick}
              onDownload={handleDownload}
            />
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Aucun business plan</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Créez votre premier business plan pour projeter vos revenus, charges et rentabilité sur plusieurs années.
          </p>
          <Button size="lg" onClick={handleCreate}>
            <Plus className="h-5 w-5 mr-2" />
            Créer mon premier Business Plan
          </Button>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le Business Plan ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le business plan "{bpToDelete?.name}" et toutes ses données seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
