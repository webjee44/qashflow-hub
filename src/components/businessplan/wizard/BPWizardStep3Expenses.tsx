import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Receipt, Users, Pencil, Trash2, Loader2, ListPlus, X } from 'lucide-react';
import { useBPFixedExpenses, BPFixedExpense } from '@/hooks/useBPFixedExpenses';
import { FIXED_EXPENSE_CATEGORIES, type FixedExpenseCategory } from '@/constants/bpConstants';
import { useBPPersonnel, BPPersonnel } from '@/hooks/useBPPersonnel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

interface BulkExpenseRow {
  name: string;
  category: FixedExpenseCategory;
  monthly_amount: number;
}

const emptyBulkRow = (): BulkExpenseRow => ({ name: '', category: 'other', monthly_amount: 0 });

export function BPWizardStep3Expenses() {
  const [activeTab, setActiveTab] = useState('fixed');
  const { 
    expenses, 
    isLoading: expensesLoading, 
    createExpense, 
    updateExpense, 
    deleteExpense, 
    totalMonthlyExpenses 
  } = useBPFixedExpenses();
  const { 
    personnel, 
    isLoading: personnelLoading, 
    createPersonnel, 
    updatePersonnel, 
    deletePersonnel, 
    totalMonthlyCost: totalPersonnelCost 
  } = useBPPersonnel();

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BPFixedExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState<{
    name: string;
    category: FixedExpenseCategory;
    monthly_amount: number;
    vat_rate: number;
    is_vat_deductible: boolean;
  }>({
    name: '',
    category: 'other',
    monthly_amount: 0,
    vat_rate: 20,
    is_vat_deductible: true,
  });

  // Bulk add state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkExpenseRow[]>([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<BPPersonnel | null>(null);
  const [personnelForm, setPersonnelForm] = useState({
    position: '',
    gross_salary: 0,
    contract_type: 'cdi',
    is_executive: false,
    company_size: 'small',
  });


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Fixed Expense Handlers
  const handleOpenExpenseDialog = (expense?: BPFixedExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        name: expense.name,
        category: expense.category,
        monthly_amount: Number(expense.monthly_amount),
        vat_rate: Number(expense.vat_rate) * 100,
        is_vat_deductible: expense.is_vat_deductible,
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({ name: '', category: 'other', monthly_amount: 0, vat_rate: 20, is_vat_deductible: true });
    }
    setExpenseDialogOpen(true);
  };

  const handleSubmitExpense = async () => {
    if (editingExpense) {
      await updateExpense.mutateAsync({
        id: editingExpense.id,
        name: expenseForm.name,
        category: expenseForm.category,
        monthly_amount: expenseForm.monthly_amount,
        vat_rate: expenseForm.vat_rate / 100,
        is_vat_deductible: expenseForm.is_vat_deductible,
      });
    } else {
      await createExpense.mutateAsync({
        name: expenseForm.name,
        category: expenseForm.category,
        monthly_amount: expenseForm.monthly_amount,
        vat_rate: expenseForm.vat_rate / 100,
        is_vat_deductible: expenseForm.is_vat_deductible,
      });
    }
    setExpenseDialogOpen(false);
  };

  // Bulk Add Handlers
  const handleOpenBulkDialog = () => {
    setBulkRows([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
    setBulkDialogOpen(true);
  };

  const handleBulkRowChange = (index: number, field: keyof BulkExpenseRow, value: string | number) => {
    const newRows = [...bulkRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setBulkRows(newRows);
  };

  const handleAddBulkRow = () => {
    if (bulkRows.length < 10) {
      setBulkRows([...bulkRows, emptyBulkRow()]);
    }
  };

  const handleRemoveBulkRow = (index: number) => {
    if (bulkRows.length > 1) {
      setBulkRows(bulkRows.filter((_, i) => i !== index));
    }
  };

  const handleSubmitBulk = async () => {
    const validRows = bulkRows.filter(row => row.name.trim() && row.monthly_amount > 0);
    if (validRows.length === 0) {
      toast.error('Veuillez remplir au moins une ligne valide');
      return;
    }

    setIsBulkSaving(true);
    try {
      for (const row of validRows) {
        await createExpense.mutateAsync({
          name: row.name,
          category: row.category,
          monthly_amount: row.monthly_amount,
          vat_rate: 0.2,
          is_vat_deductible: true,
        });
      }
      toast.success(`${validRows.length} charge(s) ajoutée(s)`);
      setBulkDialogOpen(false);
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Personnel Handlers
  const handleOpenPersonnelDialog = (person?: BPPersonnel) => {
    if (person) {
      setEditingPersonnel(person);
      setPersonnelForm({
        position: person.position,
        gross_salary: Number(person.gross_salary),
        contract_type: person.contract_type,
        is_executive: person.is_executive,
        company_size: person.company_size,
      });
    } else {
      setEditingPersonnel(null);
      setPersonnelForm({ position: '', gross_salary: 0, contract_type: 'cdi', is_executive: false, company_size: 'small' });
    }
    setPersonnelDialogOpen(true);
  };

  const handleSubmitPersonnel = async () => {
    if (editingPersonnel) {
      await updatePersonnel.mutateAsync({
        id: editingPersonnel.id,
        position: personnelForm.position,
        gross_salary: personnelForm.gross_salary,
        contract_type: personnelForm.contract_type,
        is_executive: personnelForm.is_executive,
        company_size: personnelForm.company_size,
      });
    } else {
      await createPersonnel.mutateAsync({
        position: personnelForm.position,
        gross_salary: personnelForm.gross_salary,
        contract_type: personnelForm.contract_type,
        is_executive: personnelForm.is_executive,
        company_size: personnelForm.company_size,
      });
    }
    setPersonnelDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Charges prévisionnelles</h3>
        <p className="text-sm text-muted-foreground">
          Définissez vos charges fixes et vos coûts de personnel.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-red-500" />
                <span className="font-medium">Charges fixes mensuelles</span>
              </div>
              <span className="text-xl font-bold text-red-600">{formatCurrency(totalMonthlyExpenses)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Masse salariale mensuelle</span>
              </div>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(totalPersonnelCost)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="fixed" className="gap-2">
            <Receipt className="h-4 w-4" />
            Charges fixes ({expenses.length})
          </TabsTrigger>
          <TabsTrigger value="personnel" className="gap-2">
            <Users className="h-4 w-4" />
            Personnel ({personnel.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleOpenBulkDialog} className="gap-2">
              <ListPlus className="h-4 w-4" />
              Ajout en masse
            </Button>
            <Button onClick={() => handleOpenExpenseDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter une charge
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {expensesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>Aucune charge fixe configurée</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Montant/mois</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.name}</TableCell>
                        <TableCell>{FIXED_EXPENSE_CATEGORIES[expense.category as keyof typeof FIXED_EXPENSE_CATEGORIES]?.label || expense.category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(expense.monthly_amount))}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenExpenseDialog(expense)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteExpense.mutateAsync(expense.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personnel" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenPersonnelDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un poste
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {personnelLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : personnel.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>Aucun poste configuré</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Poste</TableHead>
                      <TableHead>Contrat</TableHead>
                      <TableHead className="text-right">Salaire brut</TableHead>
                      <TableHead className="text-right">Coût total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personnel.map((person) => {
                      const cost = Number(person.gross_salary) * (1 + Number(person.employer_charges_rate));
                      return (
                        <TableRow key={person.id}>
                          <TableCell className="font-medium">{person.position}</TableCell>
                          <TableCell className="uppercase">{person.contract_type}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(person.gross_salary))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenPersonnelDialog(person)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deletePersonnel.mutateAsync(person.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Modifier la charge' : 'Nouvelle charge fixe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={expenseForm.name}
                onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                placeholder="Ex: Loyer bureau"
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v as FixedExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FIXED_EXPENSE_CATEGORIES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Montant mensuel (€)</Label>
              <Input
                type="number"
                value={expenseForm.monthly_amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, monthly_amount: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>TVA déductible</Label>
              <Switch
                checked={expenseForm.is_vat_deductible}
                onCheckedChange={(checked) => setExpenseForm({ ...expenseForm, is_vat_deductible: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmitExpense} disabled={!expenseForm.name}>
              {editingExpense ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personnel Dialog */}
      <Dialog open={personnelDialogOpen} onOpenChange={setPersonnelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPersonnel ? 'Modifier le poste' : 'Nouveau poste'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Intitulé du poste</Label>
              <Input
                value={personnelForm.position}
                onChange={(e) => setPersonnelForm({ ...personnelForm, position: e.target.value })}
                placeholder="Ex: Développeur"
              />
            </div>
            <div className="space-y-2">
              <Label>Salaire brut mensuel (€)</Label>
              <Input
                type="number"
                value={personnelForm.gross_salary}
                onChange={(e) => setPersonnelForm({ ...personnelForm, gross_salary: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de contrat</Label>
                <Select value={personnelForm.contract_type} onValueChange={(v) => setPersonnelForm({ ...personnelForm, contract_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cdi">CDI</SelectItem>
                    <SelectItem value="cdd">CDD</SelectItem>
                    <SelectItem value="apprentice">Apprentissage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taille entreprise</Label>
                <Select value={personnelForm.company_size} onValueChange={(v) => setPersonnelForm({ ...personnelForm, company_size: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">&lt; 11 salariés</SelectItem>
                    <SelectItem value="medium">11-49 salariés</SelectItem>
                    <SelectItem value="large">≥ 50 salariés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Statut cadre</Label>
              <Switch
                checked={personnelForm.is_executive}
                onCheckedChange={(checked) => setPersonnelForm({ ...personnelForm, is_executive: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonnelDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmitPersonnel} disabled={!personnelForm.position}>
              {editingPersonnel ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5" />
              Ajout en masse
            </DialogTitle>
            <DialogDescription>
              Saisissez rapidement jusqu'à 10 charges fixes. Seules les lignes avec un nom et un montant seront créées.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-[1fr_140px_140px_40px] gap-2 text-sm font-medium text-muted-foreground px-1">
              <span>Nom de la charge</span>
              <span>Catégorie</span>
              <span>Montant/mois</span>
              <span></span>
            </div>
            
            {/* Rows */}
            {bulkRows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_140px_140px_40px] gap-2 items-center">
                <Input
                  placeholder="Ex: Loyer bureau"
                  value={row.name}
                  onChange={(e) => handleBulkRowChange(index, 'name', e.target.value)}
                />
                <Select 
                  value={row.category} 
                  onValueChange={(v) => handleBulkRowChange(index, 'category', v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIXED_EXPENSE_CATEGORIES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={row.monthly_amount || ''}
                    onChange={(e) => handleBulkRowChange(index, 'monthly_amount', Number(e.target.value))}
                    className="pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveBulkRow(index)}
                  disabled={bulkRows.length <= 1}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {/* Add row button */}
            {bulkRows.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddBulkRow}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter une ligne ({bulkRows.length}/10)
              </Button>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmitBulk} 
              disabled={isBulkSaving || bulkRows.every(r => !r.name.trim() || r.monthly_amount <= 0)}
              className="gap-2"
            >
              {isBulkSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ListPlus className="h-4 w-4" />
              )}
              Créer les charges
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
