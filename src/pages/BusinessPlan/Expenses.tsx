import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Building2, FileSpreadsheet, Loader2, FileDown, Briefcase, Store, Code, Stethoscope, Utensils } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { ExpenseTable, SectionNotes, ExternalServicesSummary } from '@/features/business-plan/components';
import { ExpenseDialog, BPExportDialog, BulkEditExpenseDialog } from '@/features/business-plan/dialogs';
import { UnifiedExpense } from '@/features/business-plan/dialogs/ExpenseDialog';
import { useBPFixedExpenses, BPFixedExpense } from '@/hooks/useBPFixedExpenses';
import { useVariableExpenses, VariableExpense } from '@/hooks/useVariableExpenses';
import { useCurrentBusinessPlan } from '@/hooks/useCurrentBusinessPlan';
import { PageHeader } from '@/components/layout/PageHeader';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

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

export default function Expenses() {
  const { isLoading: isLoadingBP } = useCurrentBusinessPlan();
  const queryClient = useQueryClient();
  
  const { expenses: fixedExpenses, createExpense: createFixed, updateExpense: updateFixed } = useBPFixedExpenses();
  const { expenses: variableExpenses, createExpense: createVariable, updateExpense: updateVariable } = useVariableExpenses();

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<UnifiedExpense | null>(null);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | null>(null);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

  // Show loading while BP is being loaded/created
  if (isLoadingBP) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
        await createFixed.mutateAsync({
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

  const handleSaveFixed = (data: Partial<BPFixedExpense>) => {
    if (data.id) {
      updateFixed.mutate({ id: data.id, ...data });
    } else {
      createFixed.mutate(data);
    }
  };

  const handleSaveVariable = async (data: Partial<VariableExpense>) => {
    if (data.id) {
      await updateVariable.mutateAsync({ id: data.id, ...data });
    } else {
      await createVariable.mutateAsync(data as Omit<VariableExpense, 'id' | 'user_id' | 'company_id' | 'created_at' | 'updated_at'>);
    }
  };

  const handleEditExpense = (expense: UnifiedExpense) => {
    setSelectedExpense(expense);
    setExpenseDialogOpen(true);
  };

  const allExpenses = fixedExpenses.length + variableExpenses.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Charges"
        subtitle="Gérez vos charges fixes et variables"
        actions={<BPExportDialog />}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card data-tour-bp="expenses-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Charges</CardTitle>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-tour-bp="expense-template" size="sm" variant="outline" className="gap-2">
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
                onClick={() => setBulkEditDialogOpen(true)}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Édition en masse
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
            {allExpenses === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Aucune charge</p>
                  <p className="text-sm">Loyer, assurances, abonnements, commissions...</p>
                </div>
              </div>
            ) : (
              <ExpenseTable onEdit={handleEditExpense} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Synthèse 61/62 pour correspondre au P&L */}
      <ExternalServicesSummary />

      <SectionNotes
        section="expenses" 
        title="Notes sur les charges"
        placeholder="Documentez vos hypothèses de charges, évolutions prévues, négociations en cours..."
      />

      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        expense={selectedExpense}
        onSaveFixed={handleSaveFixed}
        onSaveVariable={handleSaveVariable}
        isLoading={createFixed.isPending || updateFixed.isPending || createVariable.isPending || updateVariable.isPending}
      />

      {/* Bulk Edit Excel Dialog */}
      <BulkEditExpenseDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        expenses={fixedExpenses}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses'] });
        }}
      />

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
