import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { VariableExpense, VARIABLE_EXPENSE_CATEGORIES, VariableExpenseCategory, useVariableExpenses } from '@/hooks/useVariableExpenses';
import { useRevenueStreams } from '@/hooks/useRevenueStreams';
import { useBPSettings } from '@/hooks/useBPSettings';
import { Loader2, Percent, Hash } from 'lucide-react';
import { format } from 'date-fns';

interface VariableExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: VariableExpense | null;
}

const VAT_RATES = [
  { value: '0.20', label: '20%' },
  { value: '0.10', label: '10%' },
  { value: '0.055', label: '5,5%' },
  { value: '0.021', label: '2,1%' },
  { value: '0', label: '0%' },
];

export function VariableExpenseDialog({ open, onOpenChange, expense }: VariableExpenseDialogProps) {
  const { createExpense, updateExpense } = useVariableExpenses();
  const { streams } = useRevenueStreams();
  const { settings } = useBPSettings();
  
  const getDefaultStartDate = () => {
    if (settings.bp_start_date) return settings.bp_start_date;
    const now = new Date();
    const fiscalMonth = settings.fiscal_year_start_month || 1;
    const fiscalDay = settings.fiscal_year_start_day || 1;
    let fiscalYearStart = new Date(now.getFullYear(), fiscalMonth - 1, fiscalDay);
    if (fiscalYearStart > now) {
      fiscalYearStart = new Date(now.getFullYear() - 1, fiscalMonth - 1, fiscalDay);
    }
    return format(fiscalYearStart, 'yyyy-MM-dd');
  };
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'cogs' as VariableExpenseCategory,
    calculation_type: 'percentage' as 'percentage' | 'per_unit',
    linked_revenue_stream_id: '' as string,
    // Keep both the numeric value (for calculations/storage) and the raw text (for FR comma typing)
    percentage: 0,
    percentage_text: '0',
    unit_cost: 0,
    unit_cost_text: '0',
    vat_rate: 0.20,
    is_vat_deductible: true,
    is_cogs: true, // Par défaut = Coût des ventes
    start_date: '',
    end_date: '' as string,
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name,
        category: expense.category as VariableExpenseCategory,
        calculation_type: expense.calculation_type,
        linked_revenue_stream_id: expense.linked_revenue_stream_id || '',
        percentage: expense.percentage,
        percentage_text: String(expense.percentage ?? 0).replace('.', ','),
        unit_cost: expense.unit_cost,
        unit_cost_text: String(expense.unit_cost ?? 0).replace('.', ','),
        vat_rate: expense.vat_rate,
        is_vat_deductible: expense.is_vat_deductible,
        is_cogs: expense.is_cogs ?? true,
        start_date: expense.start_date,
        end_date: expense.end_date || '',
        notes: expense.notes || '',
      });
    } else {
      setFormData({
        name: '',
        category: 'cogs',
        calculation_type: 'percentage',
        linked_revenue_stream_id: '',
        percentage: 0,
        percentage_text: '0',
        unit_cost: 0,
        unit_cost_text: '0',
        vat_rate: 0.20,
        is_vat_deductible: true,
        is_cogs: true,
        start_date: getDefaultStartDate(),
        end_date: '',
        notes: '',
      });
    }
  }, [expense, open, settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      category: formData.category,
      calculation_type: formData.calculation_type,
      linked_revenue_stream_id: formData.linked_revenue_stream_id || null,
      percentage: formData.calculation_type === 'percentage' ? formData.percentage : 0,
      unit_cost: formData.calculation_type === 'per_unit' ? formData.unit_cost : 0,
      vat_rate: formData.vat_rate,
      is_vat_deductible: formData.is_vat_deductible,
      is_cogs: formData.is_cogs,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      notes: formData.notes || null,
    };

    if (expense) {
      await updateExpense.mutateAsync({ id: expense.id, ...payload });
    } else {
      await createExpense.mutateAsync(payload);
    }
    
    onOpenChange(false);
  };

  const isLoading = createExpense.isPending || updateExpense.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {expense ? 'Modifier la charge variable' : 'Nouvelle charge variable'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Commission commerciale"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="category">Catégorie</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v as VariableExpenseCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VARIABLE_EXPENSE_CATEGORIES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="linked_stream">Flux de revenus lié</Label>
              <Select
                value={formData.linked_revenue_stream_id}
                onValueChange={(v) => setFormData({ ...formData, linked_revenue_stream_id: v === 'all' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les flux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les flux</SelectItem>
                  {streams.map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>{stream.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-2">
              <Label>Type de calcul</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={formData.calculation_type === 'percentage' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData({ ...formData, calculation_type: 'percentage' })}
                >
                  <Percent className="h-4 w-4 mr-2" />
                  Pourcentage du CA
                </Button>
                <Button
                  type="button"
                  variant={formData.calculation_type === 'per_unit' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData({ ...formData, calculation_type: 'per_unit' })}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  Coût par unité
                </Button>
              </div>
            </div>
            
            {formData.calculation_type === 'percentage' ? (
              <div className="col-span-2">
                <Label htmlFor="percentage">Pourcentage du CA (%)</Label>
                <Input
                  id="percentage"
                  type="text"
                  inputMode="decimal"
                  value={formData.percentage_text}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const cleaned = raw.replace(/[^\d,\.]/g, '').replace('.', ',');
                    const parts = cleaned.split(',');
                    const normalized = parts.length > 2 ? `${parts[0]},${parts.slice(1).join('')}` : cleaned;

                    setFormData((prev) => {
                      const next = { ...prev, percentage_text: normalized };
                      const parsed = parseFloat(normalized.replace(',', '.'));
                      if (normalized === '') {
                        next.percentage = 0;
                      } else if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                        next.percentage = parsed;
                      }
                      return next;
                    });
                  }}
                  placeholder="Ex: 2,5"
                />
              </div>
            ) : (
              <div className="col-span-2">
                <Label htmlFor="unit_cost">Coût par unité (€)</Label>
                <Input
                  id="unit_cost"
                  type="text"
                  inputMode="decimal"
                  value={formData.unit_cost_text}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const cleaned = raw.replace(/[^\d,\.]/g, '').replace('.', ',');
                    const parts = cleaned.split(',');
                    const normalized = parts.length > 2 ? `${parts[0]},${parts.slice(1).join('')}` : cleaned;

                    setFormData((prev) => {
                      const next = { ...prev, unit_cost_text: normalized };
                      const parsed = parseFloat(normalized.replace(',', '.'));
                      if (normalized === '') {
                        next.unit_cost = 0;
                      } else if (!Number.isNaN(parsed) && parsed >= 0) {
                        next.unit_cost = parsed;
                      }
                      return next;
                    });
                  }}
                  placeholder="Ex: 1,50"
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="vat_rate">Taux de TVA</Label>
              <Select
                value={VAT_RATES.find(r => parseFloat(r.value) === formData.vat_rate)?.value || '0.20'}
                onValueChange={(v) => setFormData({ ...formData, vat_rate: parseFloat(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_RATES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 pt-6">
              <Switch
                id="is_vat_deductible"
                checked={formData.is_vat_deductible}
                onCheckedChange={(checked) => setFormData({ ...formData, is_vat_deductible: checked })}
              />
              <Label htmlFor="is_vat_deductible" className="cursor-pointer">
                TVA déductible
              </Label>
            </div>
            
            <div>
              <Label htmlFor="start_date">Date de début *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="end_date">Date de fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes ou commentaires..."
                rows={2}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {expense ? 'Modifier' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
