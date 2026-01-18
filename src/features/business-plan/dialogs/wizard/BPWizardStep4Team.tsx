import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Users, Pencil, Trash2, Loader2, FileText, Sparkles, Upload, ArrowRight } from 'lucide-react';
import { useBPPersonnel, BPPersonnel } from '@/hooks/useBPPersonnel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface BPWizardStep4TeamProps {
  businessPlanId?: string;
}

export function BPWizardStep4Team({ businessPlanId }: BPWizardStep4TeamProps) {
  const { 
    personnel, 
    isLoading: personnelLoading, 
    createPersonnel, 
    updatePersonnel, 
    deletePersonnel, 
    totalMonthlyCost: totalPersonnelCost 
  } = useBPPersonnel(businessPlanId);

  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<BPPersonnel | null>(null);
  const [personnelForm, setPersonnelForm] = useState({
    position: '',
    gross_salary: 0,
    contract_type: 'cdi',
    is_executive: false,
    company_size: 'small',
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
        <h3 className="text-lg font-medium">Équipe & Masse salariale</h3>
        <p className="text-sm text-muted-foreground">
          Ajoutez vos salariés actuels et futurs pour calculer automatiquement les charges.
        </p>
      </div>

      {/* Highlight Card - Import Payslip */}
      {personnel.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="secondary" className="bg-primary/20 text-primary border-0">
                  Nouveau
                </Badge>
              </div>
              <CardTitle className="text-xl mt-3">Import automatique depuis une fiche de paie</CardTitle>
              <CardDescription className="text-base">
                Téléchargez simplement une fiche de paie et notre IA calcule automatiquement :
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-600 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Charges patronales</p>
                    <p className="text-xs text-muted-foreground">Calcul précis selon le statut</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-600 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Mutuelle & Prévoyance</p>
                    <p className="text-xs text-muted-foreground">Part employeur automatique</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-600 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Taux AT/MP</p>
                    <p className="text-xs text-muted-foreground">Accident du travail</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-600 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Coût total employeur</p>
                    <p className="text-xs text-muted-foreground">Vision complète du coût</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button className="gap-2 flex-1" size="lg">
                  <Upload className="h-4 w-4" />
                  Importer une fiche de paie
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <Button variant="outline" onClick={() => handleOpenPersonnelDialog()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Saisie manuelle
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Summary Card */}
      {personnel.length > 0 && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <span className="font-medium">Masse salariale mensuelle</span>
                  <p className="text-sm text-muted-foreground">{personnel.length} salarié(s)</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(totalPersonnelCost)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {personnel.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Importer fiche de paie
          </Button>
          <Button onClick={() => handleOpenPersonnelDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un salarié
          </Button>
        </div>
      )}

      {/* Personnel Table */}
      {personnel.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            {personnelLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Poste</TableHead>
                    <TableHead>Contrat</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Salaire brut</TableHead>
                    <TableHead className="text-right">Coût employeur</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnel.map((person) => {
                    const cost = Number(person.gross_salary) * (1 + Number(person.employer_charges_rate));
                    return (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">{person.position}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">{person.contract_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={person.is_executive ? "default" : "secondary"}>
                            {person.is_executive ? 'Cadre' : 'Non-cadre'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(person.gross_salary))}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(cost)}</TableCell>
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
      )}

      {/* Personnel Dialog */}
      <Dialog open={personnelDialogOpen} onOpenChange={setPersonnelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPersonnel ? 'Modifier le salarié' : 'Nouveau salarié'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Poste / Fonction</Label>
              <Input
                value={personnelForm.position}
                onChange={(e) => setPersonnelForm({ ...personnelForm, position: e.target.value })}
                placeholder="Ex: Développeur Full Stack"
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
            <div className="space-y-2">
              <Label>Type de contrat</Label>
              <Select value={personnelForm.contract_type} onValueChange={(v) => setPersonnelForm({ ...personnelForm, contract_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cdi">CDI</SelectItem>
                  <SelectItem value="cdd">CDD</SelectItem>
                  <SelectItem value="apprentice">Apprentissage</SelectItem>
                  <SelectItem value="intern">Stage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taille entreprise</Label>
              <Select value={personnelForm.company_size} onValueChange={(v) => setPersonnelForm({ ...personnelForm, company_size: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Moins de 50 salariés</SelectItem>
                  <SelectItem value="medium">50 à 249 salariés</SelectItem>
                  <SelectItem value="large">250 salariés et plus</SelectItem>
                </SelectContent>
              </Select>
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
            <Button onClick={handleSubmitPersonnel} disabled={!personnelForm.position || createPersonnel.isPending || updatePersonnel.isPending}>
              {editingPersonnel ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
