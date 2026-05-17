import { useState, useEffect } from 'react';
import { Palette, Percent, Check, TrendingUp, TrendingDown, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Category } from '@/hooks/useCategories';
import type { StoredCashFlowBucket } from '@/features/treasury/types/treasuryActuals';
import { cn } from '@/lib/utils';

interface CategoryDialogProps {
  category?: Category | null;
  availableGroups?: Category[];
  onSave: (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    vat_rate: number;
    parent_id?: string | null;
    forecast_mode?: 'manual' | 'percent_of_revenue';
    forecast_percent?: number;
    cash_flow_bucket?: StoredCashFlowBucket | null;
  }) => Promise<any>;
  onClose?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const INCOME_BUCKETS: { value: StoredCashFlowBucket; label: string }[] = [
  { value: 'revenue', label: "Chiffre d'affaires" },
  { value: 'other_inflow', label: 'Autre encaissement' },
];

const EXPENSE_BUCKETS: { value: StoredCashFlowBucket; label: string }[] = [
  { value: 'fixed_expenses', label: 'Charges fixes' },
  { value: 'variable_expenses', label: 'Charges variables' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'payroll_taxes', label: 'Charges sociales' },
  { value: 'investments', label: 'Investissements' },
  { value: 'loan_payments', label: "Remboursements d'emprunt" },
  { value: 'vat_payments', label: 'TVA' },
  { value: 'tax_payments', label: 'Impôts & taxes' },
];

const colorOptions = [
  { value: 'hsl(142, 76%, 36%)', label: 'Vert' },
  { value: 'hsl(200, 80%, 50%)', label: 'Bleu' },
  { value: 'hsl(173, 80%, 40%)', label: 'Turquoise' },
  { value: 'hsl(0, 84%, 60%)', label: 'Rouge' },
  { value: 'hsl(280, 60%, 50%)', label: 'Violet' },
  { value: 'hsl(38, 92%, 50%)', label: 'Orange' },
  { value: 'hsl(320, 70%, 50%)', label: 'Rose' },
  { value: 'hsl(221, 83%, 53%)', label: 'Indigo' },
  { value: 'hsl(45, 93%, 47%)', label: 'Jaune' },
  { value: 'hsl(160, 60%, 45%)', label: 'Émeraude' },
];

const vatOptions = [
  { value: 0, label: '0%', description: 'Exonéré' },
  { value: 0.055, label: '5.5%', description: 'Réduit' },
  { value: 0.10, label: '10%', description: 'Intermédiaire' },
  { value: 0.20, label: '20%', description: 'Normal' },
];

export function CategoryDialog({ 
  category,
  availableGroups = [],
  onSave, 
  onClose,
  trigger, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
}: CategoryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCustomVat, setShowCustomVat] = useState(false);
  const [form, setForm] = useState({
    name: '',
    color: 'hsl(221, 83%, 53%)',
    icon: 'Tag',
    type: 'expense' as 'income' | 'expense',
    vat_rate: 0.20,
    parent_id: null as string | null,
    forecast_mode: 'manual' as 'manual' | 'percent_of_revenue',
    forecast_percent: 0,
    cash_flow_bucket: null as StoredCashFlowBucket | null,
  });

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  // Filter groups by selected type
  const filteredGroups = availableGroups.filter(g => g.type === form.type);

  useEffect(() => {
    if (category) {
      const isPredefined = vatOptions.some(opt => opt.value === category.vat_rate);
      setShowCustomVat(!isPredefined);
      setForm({
        name: category.name,
        color: category.color,
        icon: category.icon,
        type: category.type,
        vat_rate: category.vat_rate,
        parent_id: category.parent_id || null,
        forecast_mode: category.forecast_mode || 'manual',
        forecast_percent: category.forecast_percent || 0,
        cash_flow_bucket: category.cash_flow_bucket ?? null,
      });
    } else {
      setShowCustomVat(false);
      setForm({
        name: '',
        color: 'hsl(221, 83%, 53%)',
        icon: 'Tag',
        type: 'expense',
        vat_rate: 0.20,
        parent_id: null,
        forecast_mode: 'manual',
        forecast_percent: 0,
        cash_flow_bucket: null,
      });
    }
  }, [category, open]);

  // Reset bucket when type changes (income vs expense buckets are disjoint)
  useEffect(() => {
    if (!form.cash_flow_bucket) return;
    const allowed = (form.type === 'income' ? INCOME_BUCKETS : EXPENSE_BUCKETS)
      .map(b => b.value);
    if (!allowed.includes(form.cash_flow_bucket)) {
      setForm(prev => ({ ...prev, cash_flow_bucket: null }));
    }
  }, [form.type, form.cash_flow_bucket]);

  // Reset parent_id when type changes (groups are type-specific)
  useEffect(() => {
    if (form.parent_id) {
      const parentGroup = availableGroups.find(g => g.id === form.parent_id);
      if (parentGroup && parentGroup.type !== form.type) {
        setForm(prev => ({ ...prev, parent_id: null }));
      }
    }
  }, [form.type, form.parent_id, availableGroups]);

  const handleCustomVatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value) || 0;
    setForm({ ...form, vat_rate: percent / 100 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setLoading(true);
    const result = await onSave(form);
    setLoading(false);

    if (result) {
      setOpen(false);
      onClose?.();
    }
  };

  const formatVatDisplay = (rate: number) => {
    return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            {category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la catégorie</Label>
            <Input
              id="name"
              placeholder="Ex: Abonnements"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={50}
              autoFocus
            />
          </div>

          {/* Type Selection - Radio buttons */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'expense' })}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                  form.type === 'expense'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <TrendingDown className="w-4 h-4" />
                <span className="font-medium">Dépense</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'income', forecast_mode: 'manual', forecast_percent: 0 })}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                  form.type === 'income'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Revenu</span>
              </button>
            </div>
          </div>

          {/* Forecast Mode - only for expense categories */}
          {form.type === 'expense' && (
            <div className="space-y-2">
              <Label>Mode de prévision</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, forecast_mode: 'manual', forecast_percent: 0 })}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                    form.forecast_mode === 'manual'
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-medium text-sm">Manuel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, forecast_mode: 'percent_of_revenue' })}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                    form.forecast_mode === 'percent_of_revenue'
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Percent className="w-4 h-4" />
                  <span className="font-medium text-sm">% du CA</span>
                </button>
              </div>
              {form.forecast_mode === 'percent_of_revenue' && (
                <div className="space-y-1.5">
                  <Label htmlFor="forecast-percent">Pourcentage du CA HT</Label>
                  <div className="relative">
                    <Input
                      id="forecast-percent"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="Ex: 20"
                      value={form.forecast_percent || ''}
                      onChange={(e) => setForm({ ...form, forecast_percent: parseFloat(e.target.value) || 0 })}
                      className="pr-8"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Le montant sera calculé automatiquement : {form.forecast_percent || 0}% × CA HT prévu du mois
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cash flow bucket (used by Treasury engine) */}
          <div className="space-y-2">
            <Label>Catégorie de flux de trésorerie</Label>
            <Select
              value={form.cash_flow_bucket ?? 'none'}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  cash_flow_bucket: value === 'none' ? null : (value as StoredCashFlowBucket),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Non classé" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Non classé</span>
                </SelectItem>
                {(form.type === 'income' ? INCOME_BUCKETS : EXPENSE_BUCKETS).map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Détermine comment cette catégorie apparaît dans la trésorerie réelle.
            </p>
          </div>

          {/* Group Selection */}
          {filteredGroups.length > 0 && (
            <div className="space-y-2">
              <Label>Groupe (optionnel)</Label>
              <Select
                value={form.parent_id || 'none'}
                onValueChange={(value) => setForm({ ...form, parent_id: value === 'none' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun groupe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Aucun groupe</span>
                  </SelectItem>
                  {filteredGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: group.color }}
                        />
                        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        {group.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* VAT Selection - Radio buttons */}
          <div className="space-y-2">
            <Label>Taux de TVA</Label>
            <div className="grid grid-cols-4 gap-2">
              {vatOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setForm({ ...form, vat_rate: opt.value });
                    setShowCustomVat(false);
                  }}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg border-2 transition-all",
                    form.vat_rate === opt.value && !showCustomVat
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-semibold text-sm">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.description}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowCustomVat(true)}
              className={cn(
                "w-full flex items-center justify-center gap-2 p-2 rounded-lg border-2 border-dashed transition-all text-sm",
                showCustomVat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50 text-muted-foreground"
              )}
            >
              <Percent className="w-3.5 h-3.5" />
              Taux personnalisé
            </button>
          </div>

          {showCustomVat && (
            <div className="space-y-2">
              <Label htmlFor="custom-vat">Taux personnalisé (%)</Label>
              <div className="relative">
                <Input
                  id="custom-vat"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="Ex: 8.5"
                  value={(form.vat_rate * 100).toFixed(1)}
                  onChange={handleCustomVatChange}
                  className="pr-8"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: color.value })}
                  className={cn(
                    "w-10 h-10 rounded-lg transition-all flex items-center justify-center",
                    form.color === color.value 
                      ? 'ring-2 ring-primary ring-offset-2 scale-110' 
                      : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                >
                  {form.color === color.value && (
                    <Check className="w-5 h-5 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-2">Aperçu</p>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${form.color}20` }}
              >
                <div 
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: form.color }}
                />
              </div>
              <div>
                <span className="font-medium">{form.name || 'Nom de la catégorie'}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{form.type === 'income' ? 'Revenu' : 'Dépense'}</span>
                  <span>•</span>
                  <span>TVA {formatVatDisplay(form.vat_rate)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="gradient-primary"
              disabled={loading || !form.name.trim()}
            >
              {loading ? 'Enregistrement...' : category ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}