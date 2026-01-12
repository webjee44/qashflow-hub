import { useState, useEffect } from 'react';
import { Palette, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Category } from '@/hooks/useCategories';

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
  { value: '0', label: '0% (Exonéré)' },
  { value: '0.055', label: '5.5% (Réduit)' },
  { value: '0.10', label: '10% (Intermédiaire)' },
  { value: '0.20', label: '20% (Normal)' },
  { value: 'custom', label: 'Personnalisé' },
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

  const getVatSelectValue = (rate: number): string => {
    const predefined = vatOptions.find(opt => opt.value !== 'custom' && parseFloat(opt.value) === rate);
    return predefined ? predefined.value : 'custom';
  };

  useEffect(() => {
    if (category) {
      const vatValue = getVatSelectValue(category.vat_rate);
      setShowCustomVat(vatValue === 'custom');
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

  const handleVatChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomVat(true);
    } else {
      setShowCustomVat(false);
      setForm({ ...form, vat_rate: parseFloat(value) });
    }
  };

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
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la catégorie</Label>
            <Input
              id="name"
              placeholder="Ex: Abonnements"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value: 'income' | 'expense') => setForm({ ...form, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Revenu</SelectItem>
                  <SelectItem value="expense">Dépense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Taux de TVA</Label>
              <Select
                value={getVatSelectValue(form.vat_rate)}
                onValueChange={handleVatChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vatOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: color.value })}
                  className={`w-10 h-10 rounded-lg transition-all ${
                    form.color === color.value 
                      ? 'ring-2 ring-primary ring-offset-2 scale-110' 
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
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