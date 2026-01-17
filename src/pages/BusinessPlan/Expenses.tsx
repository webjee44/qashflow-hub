import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Building2, Users, Percent, ListPlus, X, Loader2, FileDown, Briefcase, Store, Code, Stethoscope, Utensils } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
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
      { name: 'Comptabilité', category: 'other', monthly_amount: 150 },
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
      { name: 'Comptabilité', category: 'other', monthly_amount: 200 },
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
      { name: 'Comptabilité', category: 'other', monthly_amount: 180 },
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
      { name: 'Télésecrétariat', category: 'other', monthly_amount: 250 },
      { name: 'Matériel consommable', category: 'other', monthly_amount: 200 },
      { name: 'Électricité & Eau', category: 'utilities', monthly_amount: 150 },
      { name: 'Comptabilité', category: 'other', monthly_amount: 200 },
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
      { name: 'Comptabilité', category: 'other', monthly_amount: 250 },
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

interface BulkPersonnelRow {
  position: string;
  gross_salary: string;
  contract_type: string;
}

const CONTRACT_TYPES = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'stage', label: 'Stage' },
  { value: 'apprentissage', label: 'Apprentissage' },
  { value: 'freelance', label: 'Freelance' },
] as const;

export default function Expenses() {
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FixedExpense | null>(null);
  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkExpenseRow[]>([{ name: '', category: '', monthly_amount: '' }]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkPersonnelDialogOpen, setBulkPersonnelDialogOpen] = useState(false);
  const [bulkPersonnelRows, setBulkPersonnelRows] = useState<BulkPersonnelRow[]>([{ position: '', gross_salary: '', contract_type: 'cdi' }]);
  const [isBulkPersonnelSaving, setIsBulkPersonnelSaving] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | null>(null);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

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

  // Personnel bulk handlers
  const handleOpenBulkPersonnelDialog = () => {
    setBulkPersonnelRows([{ position: '', gross_salary: '', contract_type: 'cdi' }]);
    setBulkPersonnelDialogOpen(true);
  };

  const handleBulkPersonnelRowChange = (index: number, field: keyof BulkPersonnelRow, value: string) => {
    setBulkPersonnelRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleAddBulkPersonnelRow = () => {
    if (bulkPersonnelRows.length < 10) {
      setBulkPersonnelRows(prev => [...prev, { position: '', gross_salary: '', contract_type: 'cdi' }]);
    }
  };

  const handleRemoveBulkPersonnelRow = (index: number) => {
    if (bulkPersonnelRows.length > 1) {
      setBulkPersonnelRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmitBulkPersonnel = async () => {
    const validRows = bulkPersonnelRows.filter(row => row.position.trim() && row.gross_salary);
    if (validRows.length === 0) {
      toast.error('Veuillez remplir au moins une ligne');
      return;
    }
    
    setIsBulkPersonnelSaving(true);
    try {
      for (const row of validRows) {
        await createPersonnel.mutateAsync({
          position: row.position.trim(),
          gross_salary: parseFloat(row.gross_salary) || 0,
          contract_type: row.contract_type || 'cdi',
        });
      }
      toast.success(`${validRows.length} poste(s) ajouté(s)`);
      setBulkPersonnelDialogOpen(false);
    } catch (error) {
      toast.error("Erreur lors de l'ajout du personnel");
    } finally {
      setIsBulkPersonnelSaving(false);
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
          category: expense.category as 'rent' | 'insurance' | 'software' | 'marketing' | 'utilities' | 'other',
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
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-2"
                    onClick={handleOpenBulkPersonnelDialog}
                  >
                    <ListPlus className="h-4 w-4" />
                    Ajout en masse
                  </Button>
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
                </div>
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

      {/* Bulk Personnel Dialog */}
      <Dialog open={bulkPersonnelDialogOpen} onOpenChange={setBulkPersonnelDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajout en masse de personnel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {bulkPersonnelRows.map((row, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Intitulé du poste"
                  value={row.position}
                  onChange={(e) => handleBulkPersonnelRowChange(index, 'position', e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={row.contract_type}
                  onValueChange={(val) => handleBulkPersonnelRowChange(index, 'contract_type', val)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Contrat" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(ct => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Brut €/mois"
                  value={row.gross_salary}
                  onChange={(e) => handleBulkPersonnelRowChange(index, 'gross_salary', e.target.value)}
                  className="w-[120px]"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveBulkPersonnelRow(index)}
                  disabled={bulkPersonnelRows.length === 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {bulkPersonnelRows.length < 10 && (
              <Button variant="outline" size="sm" onClick={handleAddBulkPersonnelRow} className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPersonnelDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmitBulkPersonnel} disabled={isBulkPersonnelSaving}>
              {isBulkPersonnelSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
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
                  Vous allez ajouter {EXPENSE_TEMPLATES[selectedTemplate].expenses.length} charges 
                  fixes du template "{EXPENSE_TEMPLATES[selectedTemplate].name}".
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <p className="text-sm font-medium text-muted-foreground mb-2">Charges incluses :</p>
              {EXPENSE_TEMPLATES[selectedTemplate].expenses.map((exp, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 px-3 bg-muted/50 rounded text-sm">
                  <span>{exp.name}</span>
                  <span className="font-medium">{exp.monthly_amount.toLocaleString('fr-FR')} €/mois</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 px-3 bg-primary/10 rounded text-sm font-semibold mt-2">
                <span>Total mensuel</span>
                <span>
                  {EXPENSE_TEMPLATES[selectedTemplate].expenses
                    .reduce((sum, e) => sum + e.monthly_amount, 0)
                    .toLocaleString('fr-FR')} €/mois
                </span>
              </div>
            </div>
          )}

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
