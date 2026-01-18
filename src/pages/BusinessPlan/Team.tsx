import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Briefcase, ListPlus, X, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PersonnelTable } from '@/components/businessplan/PersonnelTable';
import { FreelanceTable } from '@/components/businessplan/FreelanceTable';
import { PersonnelDialog } from '@/components/businessplan/PersonnelDialog';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { useBPPersonnel, BPPersonnel, WorkerType } from '@/hooks/useBPPersonnel';
import { useBusinessPlans } from '@/hooks/useBusinessPlans';
import { PageHeader } from '@/components/layout/PageHeader';
import { toast } from 'sonner';

interface BulkRow {
  position: string;
  gross_salary: string;
  contract_type: string;
}

interface BulkFreelanceRow {
  position: string;
  daily_rate: string;
  estimated_days: string;
}

const CONTRACT_TYPES = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'apprentissage', label: 'Apprentissage' },
  { value: 'stage', label: 'Stage' },
] as const;

export default function Team() {
  const { businessPlans } = useBusinessPlans();
  const currentPlan = businessPlans[0];
  
  const { 
    employees, 
    freelancers, 
    createPersonnel,
    updatePersonnel,
    totalEmployeeCost, 
    totalFreelanceCost,
    totalMonthlyCost 
  } = useBPPersonnel(currentPlan?.id);

  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<BPPersonnel | null>(null);
  const [defaultWorkerType, setDefaultWorkerType] = useState<WorkerType>('employee');
  
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([{ position: '', gross_salary: '', contract_type: 'cdi' }]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const [bulkFreelanceDialogOpen, setBulkFreelanceDialogOpen] = useState(false);
  const [bulkFreelanceRows, setBulkFreelanceRows] = useState<BulkFreelanceRow[]>([{ position: '', daily_rate: '', estimated_days: '10' }]);
  const [isBulkFreelanceSaving, setIsBulkFreelanceSaving] = useState(false);

  // Handlers pour le dialog personnel
  const handleOpenPersonnelDialog = (workerType: WorkerType = 'employee') => {
    setDefaultWorkerType(workerType);
    setSelectedPersonnel(null);
    setPersonnelDialogOpen(true);
  };

  const handleEditPersonnel = (person: BPPersonnel) => {
    setSelectedPersonnel(person);
    setDefaultWorkerType(person.worker_type);
    setPersonnelDialogOpen(true);
  };

  const handleSavePersonnel = (data: Partial<BPPersonnel>) => {
    if (data.id) {
      updatePersonnel.mutate({ id: data.id, ...data });
    } else {
      createPersonnel.mutate(data);
    }
  };

  // Handlers pour l'ajout en masse de salariés
  const handleBulkRowChange = (index: number, field: keyof BulkRow, value: string) => {
    setBulkRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleAddBulkRow = () => {
    if (bulkRows.length < 10) {
      setBulkRows(prev => [...prev, { position: '', gross_salary: '', contract_type: 'cdi' }]);
    }
  };

  const handleRemoveBulkRow = (index: number) => {
    if (bulkRows.length > 1) {
      setBulkRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmitBulk = async () => {
    const validRows = bulkRows.filter(row => row.position.trim() && row.gross_salary);
    if (validRows.length === 0) {
      toast.error('Veuillez remplir au moins une ligne');
      return;
    }
    
    setIsBulkSaving(true);
    try {
      for (const row of validRows) {
        await createPersonnel.mutateAsync({
          position: row.position.trim(),
          gross_salary: (parseFloat(row.gross_salary) || 0) / 12, // Convert annual to monthly
          contract_type: row.contract_type || 'cdi',
          worker_type: 'employee',
        });
      }
      toast.success(`${validRows.length} salarié(s) ajouté(s)`);
      setBulkDialogOpen(false);
      setBulkRows([{ position: '', gross_salary: '', contract_type: 'cdi' }]);
    } catch (error) {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Handlers pour l'ajout en masse de freelances
  const handleBulkFreelanceRowChange = (index: number, field: keyof BulkFreelanceRow, value: string) => {
    setBulkFreelanceRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleAddBulkFreelanceRow = () => {
    if (bulkFreelanceRows.length < 10) {
      setBulkFreelanceRows(prev => [...prev, { position: '', daily_rate: '', estimated_days: '10' }]);
    }
  };

  const handleRemoveBulkFreelanceRow = (index: number) => {
    if (bulkFreelanceRows.length > 1) {
      setBulkFreelanceRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmitBulkFreelance = async () => {
    const validRows = bulkFreelanceRows.filter(row => row.position.trim() && row.daily_rate);
    if (validRows.length === 0) {
      toast.error('Veuillez remplir au moins une ligne');
      return;
    }
    
    setIsBulkFreelanceSaving(true);
    try {
      for (const row of validRows) {
        await createPersonnel.mutateAsync({
          position: row.position.trim(),
          worker_type: 'freelance',
          daily_rate: parseFloat(row.daily_rate) || 0,
          estimated_days_per_month: parseFloat(row.estimated_days) || 10,
        });
      }
      toast.success(`${validRows.length} freelance(s) ajouté(s)`);
      setBulkFreelanceDialogOpen(false);
      setBulkFreelanceRows([{ position: '', daily_rate: '', estimated_days: '10' }]);
    } catch (error) {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setIsBulkFreelanceSaving(false);
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe"
        subtitle="Gérez vos salariés et prestataires externes"
        actions={<BPExportDialog />}
      />

      {/* Résumé global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Masse salariale</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(totalEmployeeCost)}/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Briefcase className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prestations externes</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(totalFreelanceCost)}/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Users className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Coût total équipe</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(totalMonthlyCost)}/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees" className="gap-2">
            <User className="h-4 w-4" />
            Salariés ({employees.length})
          </TabsTrigger>
          <TabsTrigger value="freelancers" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Freelances ({freelancers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Salariés</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setBulkRows([{ position: '', gross_salary: '', contract_type: 'cdi' }]);
                      setBulkDialogOpen(true);
                    }}
                  >
                    <ListPlus className="h-4 w-4" />
                    Ajout en masse
                  </Button>
                  <Button 
                    size="sm" 
                    className="gap-2"
                    onClick={() => handleOpenPersonnelDialog('employee')}
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un salarié
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {employees.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <User className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">Aucun salarié</p>
                      <p className="text-sm">CDI, CDD, apprentis, stagiaires...</p>
                    </div>
                  </div>
                ) : (
                  <PersonnelTable onEdit={handleEditPersonnel} businessPlanId={currentPlan?.id} />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="freelancers">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Freelances & Prestataires</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setBulkFreelanceRows([{ position: '', daily_rate: '', estimated_days: '10' }]);
                      setBulkFreelanceDialogOpen(true);
                    }}
                  >
                    <ListPlus className="h-4 w-4" />
                    Ajout en masse
                  </Button>
                  <Button 
                    size="sm" 
                    className="gap-2"
                    onClick={() => handleOpenPersonnelDialog('freelance')}
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un freelance
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {freelancers.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Briefcase className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">Aucun freelance</p>
                      <p className="text-sm">Prestataires, consultants, sous-traitants...</p>
                    </div>
                  </div>
                ) : (
                  <FreelanceTable onEdit={handleEditPersonnel} businessPlanId={currentPlan?.id} />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      <SectionNotes section="personnel" />

      {/* Dialog ajout/modification */}
      <PersonnelDialog
        open={personnelDialogOpen}
        onOpenChange={setPersonnelDialogOpen}
        personnel={selectedPersonnel}
        defaultWorkerType={defaultWorkerType}
        onSave={handleSavePersonnel}
      />

      {/* Dialog ajout en masse salariés */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ajout en masse de salariés</DialogTitle>
            <DialogDescription>
              Ajoutez plusieurs salariés rapidement (max 10)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {bulkRows.map((row, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Poste"
                  value={row.position}
                  onChange={(e) => handleBulkRowChange(index, 'position', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Brut annuel"
                  value={row.gross_salary}
                  onChange={(e) => handleBulkRowChange(index, 'gross_salary', e.target.value)}
                  className="w-32"
                />
                <Select value={row.contract_type} onValueChange={(v) => handleBulkRowChange(index, 'contract_type', v)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveBulkRow(index)}
                  disabled={bulkRows.length === 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={handleAddBulkRow} disabled={bulkRows.length >= 10} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une ligne
          </Button>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmitBulk} disabled={isBulkSaving}>
              {isBulkSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter {bulkRows.filter(r => r.position.trim() && r.gross_salary).length} salarié(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ajout en masse freelances */}
      <Dialog open={bulkFreelanceDialogOpen} onOpenChange={setBulkFreelanceDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ajout en masse de freelances</DialogTitle>
            <DialogDescription>
              Ajoutez plusieurs freelances rapidement (max 10)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {bulkFreelanceRows.map((row, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Mission"
                  value={row.position}
                  onChange={(e) => handleBulkFreelanceRowChange(index, 'position', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="TJM (€)"
                  value={row.daily_rate}
                  onChange={(e) => handleBulkFreelanceRowChange(index, 'daily_rate', e.target.value)}
                  className="w-28"
                />
                <Input
                  type="number"
                  placeholder="Jours/mois"
                  value={row.estimated_days}
                  onChange={(e) => handleBulkFreelanceRowChange(index, 'estimated_days', e.target.value)}
                  className="w-28"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveBulkFreelanceRow(index)}
                  disabled={bulkFreelanceRows.length === 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={handleAddBulkFreelanceRow} disabled={bulkFreelanceRows.length >= 10} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une ligne
          </Button>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkFreelanceDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmitBulkFreelance} disabled={isBulkFreelanceSaving}>
              {isBulkFreelanceSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter {bulkFreelanceRows.filter(r => r.position.trim() && r.daily_rate).length} freelance(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
