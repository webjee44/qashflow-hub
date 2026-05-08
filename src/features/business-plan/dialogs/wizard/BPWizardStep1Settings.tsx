import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBusinessPlans, BusinessPlan } from '@/hooks/useBusinessPlans';
import { Save, Loader2, Building2, Calendar, Wallet, FileText } from 'lucide-react';

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
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold">Paramètres du Business Plan</h3>
        <p className="text-muted-foreground mt-1">
          Configurez les informations de base de votre business plan.
        </p>
      </div>

      {/* Section 1: Informations générales */}
      <section className="rounded-xl bg-card border shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-medium">Informations générales</h4>
            <p className="text-sm text-muted-foreground">Nom et description de votre projet</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Nom du Business Plan *</Label>
            <Input
              id="name"
              placeholder="Ex: BP 2025 - Mon projet"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              placeholder="Décrivez brièvement votre projet..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </section>

      {/* Section 2: Période de projection */}
      <section className="rounded-xl bg-card border shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="p-2 rounded-lg bg-accent/20">
            <Calendar className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h4 className="font-medium">Période de projection</h4>
            <p className="text-sm text-muted-foreground">Définissez la durée de votre business plan</p>
          </div>
        </div>
        
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bp_start_date" className="text-sm font-medium">Date de démarrage</Label>
            <Input
              id="bp_start_date"
              type="date"
              value={formData.bp_start_date}
              onChange={(e) => setFormData({ ...formData, bp_start_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bp_years" className="text-sm font-medium">Durée (années)</Label>
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
            <Label htmlFor="fiscal_year_start_month" className="text-sm font-medium">Début exercice fiscal</Label>
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
        </div>
      </section>

      {/* Section 3: Paramètres financiers */}
      <section className="rounded-xl bg-card border shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="p-2 rounded-lg bg-success/10">
            <Wallet className="h-5 w-5 text-success" />
          </div>
          <div>
            <h4 className="font-medium">Paramètres financiers</h4>
            <p className="text-sm text-muted-foreground">Délais de paiement et trésorerie initiale</p>
          </div>
        </div>
        
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="customer_payment_delay" className="text-sm font-medium">Délai paiement clients</Label>
            <div className="relative">
              <Input
                id="customer_payment_delay"
                type="number"
                value={formData.customer_payment_delay}
                onChange={(e) => setFormData({ ...formData, customer_payment_delay: Number(e.target.value) })}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">jours</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier_payment_delay" className="text-sm font-medium">Délai paiement fournisseurs</Label>
            <div className="relative">
              <Input
                id="supplier_payment_delay"
                type="number"
                value={formData.supplier_payment_delay}
                onChange={(e) => setFormData({ ...formData, supplier_payment_delay: Number(e.target.value) })}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">jours</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial_cash" className="text-sm font-medium">Trésorerie initiale</Label>
            <div className="relative">
              <Input
                id="initial_cash"
                type="number"
                value={formData.initial_cash}
                onChange={(e) => setFormData({ ...formData, initial_cash: Number(e.target.value) })}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Régime fiscal */}
      <section className="rounded-xl bg-card border shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="p-2 rounded-lg bg-warning/10">
            <FileText className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h4 className="font-medium">Régime fiscal</h4>
            <p className="text-sm text-muted-foreground">Configuration fiscale de votre entreprise</p>
          </div>
        </div>
        
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tax_regime" className="text-sm font-medium">Régime d'imposition</Label>
            <Select
              value={formData.tax_regime}
              onValueChange={(v) => setFormData({ ...formData, tax_regime: v })}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="is">Impôt sur les Sociétés (IS)</SelectItem>
                <SelectItem value="ir">Impôt sur le Revenu (IR)</SelectItem>
                <SelectItem value="micro">Micro-entreprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label className="font-medium">PME au sens fiscal</Label>
              <p className="text-sm text-muted-foreground">
                Bénéficiez du taux réduit d'IS à 15% sur les premiers 42 500€
              </p>
            </div>
            <Switch
              checked={formData.is_pme}
              onCheckedChange={(checked) => setFormData({ ...formData, is_pme: checked })}
            />
          </div>
        </div>
      </section>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSubmit} 
          disabled={!formData.name || isLoading}
          size="lg"
          className="gap-2 px-8"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {businessPlan ? 'Enregistrer les modifications' : 'Créer et continuer'}
        </Button>
      </div>
    </div>
  );
}
