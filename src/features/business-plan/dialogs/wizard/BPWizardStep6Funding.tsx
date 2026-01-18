import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Wallet, PiggyBank, Landmark, Gift, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useBPFinancings, BPFinancing } from '@/hooks/useBPFinancings';
import { useBPInvestments } from '@/hooks/useBPInvestments';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

interface BPWizardStep6FundingProps {
  businessPlanId?: string;
}

const FINANCING_TYPES = {
  capital: { label: 'Capital', icon: PiggyBank, color: 'text-primary' },
  loan: { label: 'Emprunt bancaire', icon: Landmark, color: 'text-blue-600' },
  grant: { label: 'Subvention', icon: Gift, color: 'text-amber-600' },
  current_account: { label: 'Compte courant', icon: Wallet, color: 'text-green-600' },
};

export function BPWizardStep6Funding({ businessPlanId }: BPWizardStep6FundingProps) {
  const { 
    financings, 
    isLoading, 
    createFinancing, 
    updateFinancing, 
    deleteFinancing,
    totalCapital,
    totalLoans,
    totalGrants,
    totalFunding 
  } = useBPFinancings(businessPlanId);
  
  const { totalInvestments } = useBPInvestments(businessPlanId);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFinancing, setEditingFinancing] = useState<BPFinancing | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    financing_type: 'loan' as const,
    amount: 0,
    interest_rate: 3,
    duration_months: 60,
    start_date: format(new Date(), 'yyyy-MM-dd'),
  });

  if (!businessPlanId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Veuillez d'abord créer le business plan dans l'onglet Paramètres.</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const fundingGap = totalInvestments - totalFunding;

  const handleOpenDialog = (financing?: BPFinancing) => {
    if (financing) {
      setEditingFinancing(financing);
      setFormData({
        name: financing.name,
        financing_type: financing.financing_type as any,
        amount: Number(financing.amount),
        interest_rate: Number(financing.interest_rate),
        duration_months: financing.duration_months,
        start_date: financing.start_date,
      });
    } else {
      setEditingFinancing(null);
      setFormData({
        name: '',
        financing_type: 'loan',
        amount: 0,
        interest_rate: 3,
        duration_months: 60,
        start_date: format(new Date(), 'yyyy-MM-dd'),
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingFinancing) {
      await updateFinancing.mutateAsync({
        id: editingFinancing.id,
        ...formData,
      });
    } else {
      await createFinancing.mutateAsync(formData);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer ce financement ?')) {
      await deleteFinancing.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Plan de financement</h3>
          <p className="text-sm text-muted-foreground">
            Définissez vos sources de financement.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un financement
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <PiggyBank className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Capital</p>
                <p className="text-lg font-bold">{formatCurrency(totalCapital)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Emprunts</p>
                <p className="text-lg font-bold">{formatCurrency(totalLoans)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">Subventions</p>
                <p className="text-lg font-bold">{formatCurrency(totalGrants)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={fundingGap > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-green-500/20 bg-green-500/5'}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Wallet className={fundingGap > 0 ? 'h-5 w-5 text-red-600' : 'h-5 w-5 text-green-600'} />
              <div>
                <p className="text-xs text-muted-foreground">
                  {fundingGap > 0 ? 'Besoin de financement' : 'Excédent'}
                </p>
                <p className="text-lg font-bold">{formatCurrency(Math.abs(fundingGap))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financing Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sources de financement</CardTitle>
          <CardDescription>Capital, emprunts, subventions...</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : financings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Aucun financement configuré</p>
              <Button variant="link" onClick={() => handleOpenDialog()}>
                Ajouter votre première source de financement
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financings.map((fin) => {
                  const typeInfo = FINANCING_TYPES[fin.financing_type as keyof typeof FINANCING_TYPES];
                  return (
                    <TableRow key={fin.id}>
                      <TableCell className="font-medium">{fin.name}</TableCell>
                      <TableCell>{typeInfo?.label || fin.financing_type}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(fin.amount))}</TableCell>
                      <TableCell className="text-right">
                        {fin.financing_type === 'loan' ? `${Number(fin.interest_rate).toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {fin.financing_type === 'loan' ? `${fin.duration_months} mois` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(fin)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(fin.id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFinancing ? 'Modifier le financement' : 'Nouveau financement'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Emprunt bancaire BPI"
              />
            </div>

            <div className="space-y-2">
              <Label>Type de financement</Label>
              <Select 
                value={formData.financing_type} 
                onValueChange={(v) => setFormData({ ...formData, financing_type: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FINANCING_TYPES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Montant (€)</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              />
            </div>

            {formData.financing_type === 'loan' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Taux annuel (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.interest_rate}
                      onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Durée (mois)</Label>
                    <Select 
                      value={String(formData.duration_months)} 
                      onValueChange={(v) => setFormData({ ...formData, duration_months: Number(v) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 mois</SelectItem>
                        <SelectItem value="24">24 mois</SelectItem>
                        <SelectItem value="36">36 mois</SelectItem>
                        <SelectItem value="48">48 mois</SelectItem>
                        <SelectItem value="60">60 mois</SelectItem>
                        <SelectItem value="84">84 mois</SelectItem>
                        <SelectItem value="120">120 mois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Date de déblocage</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.name || createFinancing.isPending || updateFinancing.isPending}
            >
              {(createFinancing.isPending || updateFinancing.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingFinancing ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
