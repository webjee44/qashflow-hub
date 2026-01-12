import { useState, useEffect } from 'react';
import { Palette, Percent, Check, TrendingUp, TrendingDown } from 'lucide-react';
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
import { Category } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

interface CategoryDialogProps {
  category?: Category | null;
  onSave: (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    vat_rate: number;
  }) => Promise<any>;
  onClose?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

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
  onSave, 
  onClose,
  trigger, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange 
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
  });

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

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
      });
    } else {
      setShowCustomVat(false);
      setForm({
        name: '',
        color: 'hsl(221, 83%, 53%)',
        icon: 'Tag',
        type: 'expense',
        vat_rate: 0.20,
      });
    }
  }, [category, open]);

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
      <DialogContent className="sm:max-w-[425px]">
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
                onClick={() => setForm({ ...form, type: 'income' })}
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
