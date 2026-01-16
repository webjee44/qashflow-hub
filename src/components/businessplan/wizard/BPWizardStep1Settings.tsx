import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBusinessPlans, BusinessPlan } from '@/hooks/useBusinessPlans';
import { Save, Loader2 } from 'lucide-react';

interface BPWizardStep1SettingsProps {
  businessPlan: BusinessPlan | null;
  onCreated: (bp: BusinessPlan) => void;
  onUpdated: (updates: Partial<BusinessPlan>) => void;
}

export function BPWizardStep1Settings({ businessPlan, onCreated, onUpdated }: BPWizardStep1SettingsProps) {
  const { createBusinessPlan, updateBusinessPlan } = useBusinessPlans();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bp_start_date: new Date().toISOString().split('T')[0],
    bp_years: 3,
    fiscal_year_start_month: 1,
    customer_payment_delay: 30,
    supplier_payment_delay: 30,
    initial_cash: 0,
    tax_regime: 'is',
    is_pme: true,
  });

  useEffect(() => {
    if (businessPlan) {
      setFormData({
        name: businessPlan.name || '',
        description: businessPlan.description || '',
        bp_start_date: businessPlan.bp_start_date || new Date().toISOString().split('T')[0],
        bp_years: businessPlan.bp_years || 3,
        fiscal_year_start_month: businessPlan.fiscal_year_start_month || 1,
        customer_payment_delay: businessPlan.customer_payment_delay || 30,
        supplier_payment_delay: businessPlan.supplier_payment_delay || 30,
        initial_cash: businessPlan.initial_cash || 0,
        tax_regime: businessPlan.tax_regime || 'is',
        is_pme: businessPlan.is_pme ?? true,
      });
    }
  }, [businessPlan]);

  const handleSubmit = async () => {
    if (businessPlan) {
      await updateBusinessPlan.mutateAsync({
        id: businessPlan.id,
        ...formData,
      });
      onUpdated(formData);
    } else {
      const newBP = await createBusinessPlan.mutateAsync({
        ...formData,
        fiscal_year_start_day: 1,
        status: 'draft',
        finalized_at: null,
        company_id: null,
      });
      onCreated(newBP);
    }
  };

  const isLoading = createBusinessPlan.isPending || updateBusinessPlan.isPending;

  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h3 className="text-lg font-medium">Paramètres du Business Plan</h3>
        <p className="text-sm text-muted-foreground">
          Configurez les informations de base de votre business plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations générales</CardTitle>
          <CardDescription>Nom et description de votre projet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du Business Plan *</Label>
            <Input
              id="name"
              placeholder="Ex: BP 2025 - Mon projet"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Décrivez brièvement votre projet..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Période de projection</CardTitle>
          <CardDescription>Définissez la durée de votre business plan</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bp_start_date">Date de démarrage</Label>
            <Input
              id="bp_start_date"
              type="date"
              value={formData.bp_start_date}
              onChange={(e) => setFormData({ ...formData, bp_start_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bp_years">Durée (années)</Label>
            <Select
              value={String(formData.bp_years)}
              onValueChange={(v) => setFormData({ ...formData, bp_years: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 ans</SelectItem>
                <SelectItem value="5">5 ans</SelectItem>
                <SelectItem value="7">7 ans</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fiscal_year_start_month">Début de l'exercice fiscal</Label>
            <Select
              value={String(formData.fiscal_year_start_month)}
              onValueChange={(v) => setFormData({ ...formData, fiscal_year_start_month: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paramètres financiers</CardTitle>
          <CardDescription>Délais de paiement et trésorerie initiale</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer_payment_delay">Délai paiement clients (jours)</Label>
            <Input
              id="customer_payment_delay"
              type="number"
              value={formData.customer_payment_delay}
              onChange={(e) => setFormData({ ...formData, customer_payment_delay: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier_payment_delay">Délai paiement fournisseurs (jours)</Label>
            <Input
              id="supplier_payment_delay"
              type="number"
              value={formData.supplier_payment_delay}
              onChange={(e) => setFormData({ ...formData, supplier_payment_delay: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial_cash">Trésorerie initiale (€)</Label>
            <Input
              id="initial_cash"
              type="number"
              value={formData.initial_cash}
              onChange={(e) => setFormData({ ...formData, initial_cash: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Régime fiscal</CardTitle>
          <CardDescription>Configuration fiscale de votre entreprise</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tax_regime">Régime d'imposition</Label>
            <Select
              value={formData.tax_regime}
              onValueChange={(v) => setFormData({ ...formData, tax_regime: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="is">Impôt sur les Sociétés (IS)</SelectItem>
                <SelectItem value="ir">Impôt sur le Revenu (IR)</SelectItem>
                <SelectItem value="micro">Micro-entreprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>PME au sens fiscal</Label>
              <p className="text-sm text-muted-foreground">
                Bénéficiez du taux réduit d'IS à 15% sur les premiers 42 500€
              </p>
            </div>
            <Switch
              checked={formData.is_pme}
              onCheckedChange={(checked) => setFormData({ ...formData, is_pme: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit} 
          disabled={!formData.name || isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {businessPlan ? 'Enregistrer' : 'Créer et continuer'}
        </Button>
      </div>
    </div>
  );
}
