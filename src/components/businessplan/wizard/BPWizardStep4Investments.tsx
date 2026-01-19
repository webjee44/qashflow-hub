import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Building2, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useBPInvestments, BPInvestment, INVESTMENT_CATEGORIES } from '@/hooks/useBPInvestments';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function BPWizardStep4Investments() {
  const { 
    investments, 
    isLoading, 
    createInvestment, 
    updateInvestment, 
    deleteInvestment, 
    totalInvestments,
    yearlyDepreciation 
  } = useBPInvestments();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<BPInvestment | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'equipment',
    purchase_date: format(new Date(), 'yyyy-MM-dd'),
    purchase_amount: 0,
    depreciation_years: 5,
    depreciation_method: 'linear',
    notes: '',
  });


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const handleOpenDialog = (investment?: BPInvestment) => {
    if (investment) {
      setEditingInvestment(investment);
      setFormData({
        name: investment.name,
        category: investment.category,
        purchase_date: investment.purchase_date,
        purchase_amount: Number(investment.purchase_amount),
        depreciation_years: investment.depreciation_years,
        depreciation_method: investment.depreciation_method,
        notes: investment.notes || '',
      });
    } else {
      setEditingInvestment(null);
      setFormData({
        name: '',
        category: 'equipment',
        purchase_date: format(new Date(), 'yyyy-MM-dd'),
        purchase_amount: 0,
        depreciation_years: 5,
        depreciation_method: 'linear',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingInvestment) {
      await updateInvestment.mutateAsync({
        id: editingInvestment.id,
        ...formData,
      });
    } else {
      await createInvestment.mutateAsync(formData);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cet investissement ?')) {
      await deleteInvestment.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Investissements</h3>
          <p className="text-sm text-muted-foreground">
            Définissez vos immobilisations et leur plan d'amortissement.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un investissement
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Total investissements</span>
              </div>
              <span className="text-xl font-bold text-purple-600">{formatCurrency(totalInvestments)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-amber-500" />
                <span className="font-medium">Amortissement annuel</span>
              </div>
              <span className="text-xl font-bold text-amber-600">{formatCurrency(yearlyDepreciation)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Investments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Immobilisations</CardTitle>
          <CardDescription>Matériel, véhicules, logiciels, aménagements...</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : investments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Aucun investissement configuré</p>
              <Button variant="link" onClick={() => handleOpenDialog()}>
                Ajouter votre premier investissement
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investments.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.name}</TableCell>
                    <TableCell>{INVESTMENT_CATEGORIES[inv.category as keyof typeof INVESTMENT_CATEGORIES]?.label || inv.category}</TableCell>
                    <TableCell>{format(new Date(inv.purchase_date), 'MMM yyyy', { locale: fr })}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(inv.purchase_amount))}</TableCell>
                    <TableCell>{inv.depreciation_years} ans</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(inv)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(inv.id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInvestment ? 'Modifier l\'investissement' : 'Nouvel investissement'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de l'investissement</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Ordinateurs portables"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVESTMENT_CATEGORIES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date d'acquisition</Label>
                <Input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Montant HT (€)</Label>
              <Input
                type="number"
                value={formData.purchase_amount}
                onChange={(e) => setFormData({ ...formData, purchase_amount: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durée d'amortissement</Label>
                <Select 
                  value={String(formData.depreciation_years)} 
                  onValueChange={(v) => setFormData({ ...formData, depreciation_years: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 ans</SelectItem>
                    <SelectItem value="5">5 ans</SelectItem>
                    <SelectItem value="7">7 ans</SelectItem>
                    <SelectItem value="10">10 ans</SelectItem>
                    <SelectItem value="20">20 ans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Méthode</Label>
                <Select 
                  value={formData.depreciation_method} 
                  onValueChange={(v) => setFormData({ ...formData, depreciation_method: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linéaire</SelectItem>
                    <SelectItem value="degressive">Dégressif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.name || createInvestment.isPending || updateInvestment.isPending}
            >
              {(createInvestment.isPending || updateInvestment.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingInvestment ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
