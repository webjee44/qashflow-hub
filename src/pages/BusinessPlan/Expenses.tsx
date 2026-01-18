import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Building2, Percent, ListPlus, X, Loader2, FileDown, Briefcase, Store, Code, Stethoscope, Utensils } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FixedExpenseTable } from '@/components/businessplan/FixedExpenseTable';
import { FixedExpenseDialog } from '@/components/businessplan/FixedExpenseDialog';
import { VariableExpenseTable } from '@/components/businessplan/VariableExpenseTable';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { useBPFixedExpenses, BPFixedExpense, FIXED_EXPENSE_CATEGORIES } from '@/hooks/useBPFixedExpenses';
import { useBusinessPlans } from '@/hooks/useBusinessPlans';
import { PageHeader } from '@/components/layout/PageHeader';
import { toast } from 'sonner';

const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Loyer' },
  { value: 'insurance', label: 'Assurances' },
  { value: 'software', label: 'Logiciels' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'utilities', label: 'Charges' },
  { value: 'professional_fees', label: 'Honoraires' },
  { value: 'other', label: 'Autres' },
] as const;

// Templates de charges fixes par type d'activité
const EXPENSE_TEMPLATES = {
  saas: {
    name: 'Startup SaaS',
    icon: Code,
    description: 'Hébergement cloud, outils dev, marketing digital',
    expenses: [
      { name: 'Hébergement Cloud (AWS/GCP)', category: 'software', monthly_amount: 500 },
      { name: 'Outils SaaS (Slack, Notion, etc.)', category: 'software', monthly_amount: 200 },
      { name: 'GitHub / GitLab', category: 'software', monthly_amount: 50 },
      { name: 'Marketing Digital', category: 'marketing', monthly_amount: 1000 },
      { name: 'Domiciliation / Coworking', category: 'rent', monthly_amount: 300 },
      { name: 'Assurance RC Pro', category: 'insurance', monthly_amount: 100 },
      { name: 'Comptabilité', category: 'professional_fees', monthly_amount: 150 },
    ],
  },
  commerce: {
    name: 'Commerce / Retail',
    icon: Store,
    description: 'Local commercial, stock, caisse',
    expenses: [
      { name: 'Loyer local commercial', category: 'rent', monthly_amount: 2000 },
      { name: 'Électricité & Chauffage', category: 'utilities', monthly_amount: 300 },
      { name: 'Assurance local + RC', category: 'insurance', monthly_amount: 200 },
      { name: 'Logiciel de caisse', category: 'software', monthly_amount: 50 },
      { name: 'Téléphone & Internet', category: 'utilities', monthly_amount: 80 },
      { name: 'Publicité locale', category: 'marketing', monthly_amount: 300 },
      { name: 'Comptabilité', category: 'professional_fees', monthly_amount: 200 },
      { name: 'Entretien / Ménage', category: 'other', monthly_amount: 150 },
    ],
  },
  conseil: {
    name: 'Cabinet Conseil',
    icon: Briefcase,
    description: 'Bureau, déplacements, outils collaboratifs',
    expenses: [
      { name: 'Location bureau / Coworking', category: 'rent', monthly_amount: 800 },
      { name: 'Assurance RC Pro', category: 'insurance', monthly_amount: 150 },
      { name: 'Outils collaboratifs', category: 'software', monthly_amount: 100 },
      { name: 'Téléphone mobile', category: 'utilities', monthly_amount: 60 },
      { name: 'Frais de déplacement', category: 'other', monthly_amount: 500 },
      { name: 'Marketing & Networking', category: 'marketing', monthly_amount: 200 },
      { name: 'Comptabilité', category: 'professional_fees', monthly_amount: 180 },
    ],
  },
  medical: {
    name: 'Profession Médicale',
    icon: Stethoscope,
    description: 'Cabinet, matériel, secrétariat',
    expenses: [
      { name: 'Loyer cabinet', category: 'rent', monthly_amount: 1500 },
      { name: 'Assurance RCP', category: 'insurance', monthly_amount: 300 },
      { name: 'Logiciel médical', category: 'software', monthly_amount: 150 },
      { name: 'Télésecrétariat', category: 'professional_fees', monthly_amount: 250 },
      { name: 'Matériel consommable', category: 'other', monthly_amount: 200 },
      { name: 'Électricité & Eau', category: 'utilities', monthly_amount: 150 },
      { name: 'Comptabilité', category: 'professional_fees', monthly_amount: 200 },
      { name: 'Formation continue', category: 'other', monthly_amount: 100 },
    ],
  },
  restaurant: {
    name: 'Restaurant / Food',
    icon: Utensils,
    description: 'Local, équipement, hygiène',
    expenses: [
      { name: 'Loyer restaurant', category: 'rent', monthly_amount: 3000 },
      { name: 'Électricité & Gaz', category: 'utilities', monthly_amount: 800 },
      { name: 'Eau', category: 'utilities', monthly_amount: 200 },
      { name: 'Assurance local + RC', category: 'insurance', monthly_amount: 250 },
      { name: 'Logiciel caisse / commandes', category: 'software', monthly_amount: 100 },
      { name: 'Hygiène & Nettoyage', category: 'other', monthly_amount: 300 },
      { name: 'Marketing local', category: 'marketing', monthly_amount: 200 },
      { name: 'Comptabilité', category: 'professional_fees', monthly_amount: 250 },
      { name: 'Entretien équipement', category: 'other', monthly_amount: 150 },
    ],
  },
} as const;

type TemplateKey = keyof typeof EXPENSE_TEMPLATES;

interface BulkExpenseRow {
  name: string;
  category: string;
  monthly_amount: string;
}

export default function Expenses() {
  const { businessPlans } = useBusinessPlans();
  const currentPlan = businessPlans[0];
  
  const { expenses, createExpense, updateExpense } = useBPFixedExpenses(currentPlan?.id);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<BPFixedExpense | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkExpenseRow[]>([{ name: '', category: '', monthly_amount: '' }]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | null>(null);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

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
          category: row.category || 'other',
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

  // Template handlers
  const handleSelectTemplate = (key: TemplateKey) => {
    setSelectedTemplate(key);
    setTemplateDialogOpen(true);
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    
    const template = EXPENSE_TEMPLATES[selectedTemplate];
    setIsApplyingTemplate(true);
    
    try {
      for (const expense of template.expenses) {
        await createExpense.mutateAsync({
          name: expense.name,
          category: expense.category,
          monthly_amount: expense.monthly_amount,
        });
      }
      toast.success(`Template "${template.name}" appliqué (${template.expenses.length} charges)`);
      setTemplateDialogOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      toast.error("Erreur lors de l'application du template");
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleSaveExpense = (data: Partial<BPFixedExpense>) => {
    if (data.id) {
      updateExpense.mutate({ id: data.id, ...data });
    } else {
      createExpense.mutate(data);
    }
  };

  const handleEditExpense = (expense: BPFixedExpense) => {
    setSelectedExpense(expense);
    setExpenseDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Charges"
        subtitle="Gérez vos charges fixes et variables"
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2">
                        <FileDown className="h-4 w-4" />
                        Templates
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Charger un template</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(Object.keys(EXPENSE_TEMPLATES) as TemplateKey[]).map((key) => {
                        const template = EXPENSE_TEMPLATES[key];
                        const Icon = template.icon;
                        return (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => handleSelectTemplate(key)}
                            className="flex flex-col items-start gap-1 py-2"
                          >
                            <div className="flex items-center gap-2 font-medium">
                              <Icon className="h-4 w-4" />
                              {template.name}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {template.description}
                            </span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  <FixedExpenseTable onEdit={handleEditExpense} businessPlanId={currentPlan?.id} />
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
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Montant/mois"
                  value={row.monthly_amount}
                  onChange={(e) => handleBulkRowChange(index, 'monthly_amount', e.target.value)}
                  className="w-[120px]"
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
          </div>
          <Button
            variant="outline"
            onClick={handleAddBulkRow}
            disabled={bulkRows.length >= 10}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une ligne
          </Button>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmitBulk} disabled={isBulkSaving}>
              {isBulkSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter {bulkRows.filter(r => r.name.trim() && r.monthly_amount).length} charge(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Confirmation Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appliquer le template</DialogTitle>
            <DialogDescription>
              {selectedTemplate && (
                <>
                  Le template "{EXPENSE_TEMPLATES[selectedTemplate].name}" va ajouter {EXPENSE_TEMPLATES[selectedTemplate].expenses.length} charges fixes à votre business plan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleApplyTemplate} disabled={isApplyingTemplate}>
              {isApplyingTemplate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
