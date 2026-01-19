import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, TrendingUp, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useBPRevenueStreams, BPRevenueStream } from '@/hooks/useBPRevenueStreams';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const REVENUE_MODELS = {
  variable: { label: 'CA variable', description: 'Saisie mensuelle manuelle' },
  subscription: { label: 'Abonnement / SaaS', description: 'Modèle avec croissance et churn' },
};

export function BPWizardStep2Revenue() {
  const { streams, isLoading, createStream, updateStream, deleteStream, totalMonthlyRevenue } = useBPRevenueStreams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<BPRevenueStream | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    model: 'variable' as 'variable' | 'subscription',
    monthly_price: 0,
    initial_subscribers: 0,
    growth_rate: 10,
    churn_rate: 5,
  });

  const handleOpenDialog = (stream?: BPRevenueStream) => {
    if (stream) {
      setEditingStream(stream);
      // Map old models to new ones
      const mappedModel = stream.model === 'subscription' ? 'subscription' : 'variable';
      setFormData({
        name: stream.name,
        model: mappedModel,
        monthly_price: Number(stream.monthly_price),
        initial_subscribers: stream.initial_subscribers,
        growth_rate: Number(stream.growth_rate) * 100,
        churn_rate: Number(stream.churn_rate) * 100,
      });
    } else {
      setEditingStream(null);
      setFormData({
        name: '',
        model: 'variable',
        monthly_price: 0,
        initial_subscribers: 0,
        growth_rate: 10,
        churn_rate: 5,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingStream) {
      await updateStream.mutateAsync({
        id: editingStream.id,
        name: formData.name,
        model: formData.model,
        monthly_price: formData.monthly_price,
        initial_subscribers: formData.initial_subscribers,
        growth_rate: formData.growth_rate / 100,
        churn_rate: formData.churn_rate / 100,
      });
    } else {
      await createStream.mutateAsync({
        name: formData.name,
        model: formData.model,
        monthly_price: formData.monthly_price,
        initial_subscribers: formData.initial_subscribers,
        growth_rate: formData.growth_rate / 100,
        churn_rate: formData.churn_rate / 100,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer ce flux de revenus ?')) {
      await deleteStream.mutateAsync(id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Hypothèses de revenus</h3>
          <p className="text-sm text-muted-foreground">
            Définissez vos différentes sources de revenus et leurs projections.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un flux
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-medium">CA mensuel estimé</span>
            </div>
            <span className="text-2xl font-bold text-primary">{formatCurrency(totalMonthlyRevenue)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Streams Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flux de revenus</CardTitle>
          <CardDescription>Vos différentes sources de revenus</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : streams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Aucun flux de revenus configuré</p>
              <Button variant="link" onClick={() => handleOpenDialog()}>
                Ajouter votre premier flux
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Modèle</TableHead>
                  <TableHead className="text-right">Montant/Prix</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams.map((stream) => (
                  <TableRow key={stream.id}>
                    <TableCell className="font-medium">{stream.name}</TableCell>
                    <TableCell>{REVENUE_MODELS[stream.model]?.label || stream.model}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(stream.monthly_price)}
                      {stream.model === 'subscription' && ` × ${stream.initial_subscribers} abonnés`}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(stream)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(stream.id)}>
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
            <DialogTitle>{editingStream ? 'Modifier le flux' : 'Nouveau flux de revenus'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du flux</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Ventes de services"
              />
            </div>

            <div className="space-y-2">
              <Label>Modèle de revenus</Label>
              <Select
                value={formData.model}
                onValueChange={(v) => setFormData({ ...formData, model: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REVENUE_MODELS).map(([key, { label, description }]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <div>{label}</div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly_price">
                {formData.model === 'subscription' ? 'Prix mensuel par abonné (€)' : 'Montant mensuel (€)'}
              </Label>
              <Input
                id="monthly_price"
                type="number"
                value={formData.monthly_price}
                onChange={(e) => setFormData({ ...formData, monthly_price: Number(e.target.value) })}
              />
            </div>

            {formData.model === 'subscription' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="initial_subscribers">Nombre initial d'abonnés</Label>
                  <Input
                    id="initial_subscribers"
                    type="number"
                    value={formData.initial_subscribers}
                    onChange={(e) => setFormData({ ...formData, initial_subscribers: Number(e.target.value) })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="growth_rate">Croissance mensuelle (%)</Label>
                    <Input
                      id="growth_rate"
                      type="number"
                      value={formData.growth_rate}
                      onChange={(e) => setFormData({ ...formData, growth_rate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="churn_rate">Churn mensuel (%)</Label>
                    <Input
                      id="churn_rate"
                      type="number"
                      value={formData.churn_rate}
                      onChange={(e) => setFormData({ ...formData, churn_rate: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.name || createStream.isPending || updateStream.isPending}
            >
              {(createStream.isPending || updateStream.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingStream ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
