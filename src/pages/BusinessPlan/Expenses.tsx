import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Building2, Users, Percent, ListPlus, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FixedExpenseTable } from '@/components/businessplan/FixedExpenseTable';
import { FixedExpenseDialog } from '@/components/businessplan/FixedExpenseDialog';
import { PersonnelTable } from '@/components/businessplan/PersonnelTable';
import { PersonnelDialog } from '@/components/businessplan/PersonnelDialog';
import { VariableExpenseTable } from '@/components/businessplan/VariableExpenseTable';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { useFixedExpenses, FixedExpense } from '@/hooks/useFixedExpenses';
import { usePersonnel, Personnel } from '@/hooks/usePersonnel';
import { PageHeader } from '@/components/layout/PageHeader';
import { toast } from 'sonner';

const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Loyer' },
  { value: 'insurance', label: 'Assurances' },
  { value: 'software', label: 'Logiciels' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'utilities', label: 'Charges' },
  { value: 'other', label: 'Autres' },
] as const;

interface BulkExpenseRow {
  name: string;
  category: string;
  monthly_amount: string;
}

export default function Expenses() {
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FixedExpense | null>(null);
  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkExpenseRow[]>([{ name: '', category: '', monthly_amount: '' }]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const { expenses, createExpense, updateExpense, deleteExpense } = useFixedExpenses();
  const { personnel, createPersonnel, updatePersonnel, deletePersonnel } = usePersonnel();

  const handleOpenBulkDialog = () => {
    setBulkRows([{ name: '', category: '', monthly_amount: '' }]);
    setBulkDialogOpen(true);
  };

  const handleBulkRowChange = (index: number, field: keyof BulkExpenseRow, value: string) => {
    setBulkRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleAddBulkRow = () => {
    if (bulkRows.length < 10) {
      setBulkRows(prev => [...prev, { name: '', category: '', monthly_amount: '' }]);
    }
  };

  const handleRemoveBulkRow = (index: number) => {
    if (bulkRows.length > 1) {
      setBulkRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmitBulk = async () => {
    const validRows = bulkRows.filter(row => row.name.trim() && row.monthly_amount);
    if (validRows.length === 0) {
      toast.error('Veuillez remplir au moins une ligne');
      return;
    }
    
    setIsBulkSaving(true);
    try {
      for (const row of validRows) {
        await createExpense.mutateAsync({
          name: row.name.trim(),
          category: (row.category || 'other') as 'rent' | 'insurance' | 'software' | 'marketing' | 'utilities' | 'other',
          monthly_amount: parseFloat(row.monthly_amount) || 0,
        });
      }
      toast.success(`${validRows.length} charge(s) ajoutée(s)`);
      setBulkDialogOpen(false);
    } catch (error) {
      toast.error("Erreur lors de l'ajout des charges");
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleSaveExpense = (data: Partial<FixedExpense>) => {
    if (data.id) {
      updateExpense.mutate(data as FixedExpense & { id: string });
    } else {
      createExpense.mutate(data);
    }
  };

  const handleEditExpense = (expense: FixedExpense) => {
    setSelectedExpense(expense);
    setExpenseDialogOpen(true);
  };

  const handleSavePersonnel = (data: Partial<Personnel>) => {
    if (data.id) {
      updatePersonnel.mutate(data as Personnel & { id: string });
    } else {
      createPersonnel.mutate(data);
    }
  };

  const handleEditPersonnel = (person: Personnel) => {
    setSelectedPersonnel(person);
    setPersonnelDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Charges & Personnel"
        subtitle="Gérez vos charges fixes, variables et votre masse salariale"
        actions={<BPExportDialog />}
      />

      <Tabs defaultValue="fixed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fixed" className="gap-2">
            <Building2 className="h-4 w-4" />
            Charges fixes
          </TabsTrigger>
          <TabsTrigger value="variable" className="gap-2">
            <Percent className="h-4 w-4" />
            Charges variables
          </TabsTrigger>
          <TabsTrigger value="personnel" className="gap-2">
            <Users className="h-4 w-4" />
            Personnel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Charges fixes</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-2"
                    onClick={handleOpenBulkDialog}
                  >
                    <ListPlus className="h-4 w-4" />
                    Ajout en masse
                  </Button>
                  <Button 
                    size="sm" 
                    className="gap-2"
                    onClick={() => {
                      setSelectedExpense(null);
                      setExpenseDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter une charge
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">Aucune charge fixe</p>
                      <p className="text-sm">Loyer, assurances, abonnements SaaS...</p>
                    </div>
                  </div>
                ) : (
                  <FixedExpenseTable onEdit={handleEditExpense} />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="variable">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <VariableExpenseTable />
          </motion.div>
        </TabsContent>

        <TabsContent value="personnel">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Personnel</CardTitle>
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => {
                    setSelectedPersonnel(null);
                    setPersonnelDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un poste
                </Button>
              </CardHeader>
              <CardContent>
                {personnel.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">Aucun personnel</p>
                      <p className="text-sm">Planifiez vos recrutements et salaires</p>
                    </div>
                  </div>
                ) : (
                  <PersonnelTable onEdit={handleEditPersonnel} />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      <SectionNotes 
        section="expenses" 
        title="Notes sur les charges"
        placeholder="Documentez vos hypothèses de charges, évolutions prévues, négociations en cours..."
      />

      <FixedExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        expense={selectedExpense}
        onSave={handleSaveExpense}
      />

      <PersonnelDialog
        open={personnelDialogOpen}
        onOpenChange={setPersonnelDialogOpen}
        personnel={selectedPersonnel}
        onSave={handleSavePersonnel}
      />

      {/* Bulk Add Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajout en masse de charges fixes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {bulkRows.map((row, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Nom de la charge"
                  value={row.name}
                  onChange={(e) => handleBulkRowChange(index, 'name', e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={row.category}
                  onValueChange={(val) => handleBulkRowChange(index, 'category', val)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="€/mois"
                  value={row.monthly_amount}
                  onChange={(e) => handleBulkRowChange(index, 'monthly_amount', e.target.value)}
                  className="w-[100px]"
                />
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
            {bulkRows.length < 10 && (
              <Button variant="outline" size="sm" onClick={handleAddBulkRow} className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmitBulk} disabled={isBulkSaving}>
              {isBulkSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
