import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar, Info, Building2, Percent, Hash, Loader2 } from 'lucide-react';
import { 
  FIXED_EXPENSE_CATEGORIES, 
  PAYMENT_FREQUENCIES, 
  DEFAULT_PAYMENT_MONTHS,
  VARIABLE_EXPENSE_CATEGORIES,
  type FixedExpenseCategory,
  type PaymentFrequency,
  type VariableExpenseCategory,
  PCG_SUBCATEGORIES,
  PCG_VARIABLE_SUBCATEGORIES,
} from '@/constants/bpConstants';
import { useBPSettings } from '@/features/business-plan/hooks';
import { useRevenueStreams } from '@/hooks/useRevenueStreams';
import { format } from 'date-fns';
import { BPFixedExpense } from '@/hooks/useBPFixedExpenses';
import { VariableExpense } from '@/hooks/useVariableExpenses';

type ExpenseType = 'fixed' | 'variable';

// Union type for expense data
export type UnifiedExpense = (BPFixedExpense & { expenseType: 'fixed' }) | (VariableExpense & { expenseType: 'variable' });

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: UnifiedExpense | null;
  onSaveFixed: (data: Partial<BPFixedExpense>) => void;
  onSaveVariable: (data: Partial<VariableExpense>) => void;
  isLoading?: boolean;
}

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const VAT_RATES = [
  { value: '0.20', label: '20%' },
  { value: '0.10', label: '10%' },
  { value: '0.055', label: '5,5%' },
  { value: '0.021', label: '2,1%' },
  { value: '0', label: '0%' },
];

export function ExpenseDialog({ 
  open, 
  onOpenChange, 
  expense, 
  onSaveFixed, 
  onSaveVariable,
  isLoading = false,
}: ExpenseDialogProps) {
  const { settings } = useBPSettings();
  const { streams } = useRevenueStreams();
  
  const getDefaultStartDate = () => {
    if (settings.bp_start_date) {
      return settings.bp_start_date;
    }
    const now = new Date();
    const fiscalMonth = settings.fiscal_year_start_month || 1;
    const fiscalDay = settings.fiscal_year_start_day || 1;
    let fiscalYearStart = new Date(now.getFullYear(), fiscalMonth - 1, fiscalDay);
    if (fiscalYearStart > now) {
      fiscalYearStart = new Date(now.getFullYear() - 1, fiscalMonth - 1, fiscalDay);
    }
    return format(fiscalYearStart, 'yyyy-MM-dd');
  };

  // Type state
  const [expenseType, setExpenseType] = useState<ExpenseType>('fixed');

  // Common fields
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [vatRate, setVatRate] = useState(0.20);
  const [isVatDeductible, setIsVatDeductible] = useState(true);

  // Fixed expense fields
  const [fixedCategory, setFixedCategory] = useState<FixedExpenseCategory>('other');
  const [amount, setAmount] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('monthly');
  const [paymentMonths, setPaymentMonths] = useState<number[]>([]);
  const [pcgSubcategory, setPcgSubcategory] = useState<string>('');

  // Variable expense fields
  const [variableCategory, setVariableCategory] = useState<VariableExpenseCategory>('cogs');
  const [calculationType, setCalculationType] = useState<'percentage' | 'per_unit'>('percentage');
  const [linkedRevenueStreamId, setLinkedRevenueStreamId] = useState<string>('');
  const [percentage, setPercentage] = useState(0);
  const [percentageRaw, setPercentageRaw] = useState('');
  const [unitCost, setUnitCost] = useState(0);
  const [unitCostRaw, setUnitCostRaw] = useState('');
  const [isCogs, setIsCogs] = useState(true);

  useEffect(() => {
    if (expense) {
      setName(expense.name);
      setStartDate(expense.start_date);
      setEndDate(expense.end_date || '');
      setNotes(expense.notes || '');

      if (expense.expenseType === 'fixed') {
        setExpenseType('fixed');
        setFixedCategory(expense.category as FixedExpenseCategory);
        setAmount(expense.monthly_amount.toString());
        setPaymentFrequency(expense.payment_frequency || 'monthly');
        setPaymentMonths(expense.payment_months || DEFAULT_PAYMENT_MONTHS[expense.payment_frequency || 'monthly']);
        setPcgSubcategory(expense.pcg_subcategory || '');
        setVatRate(expense.vat_rate ?? 0.20);
        setIsVatDeductible(expense.is_vat_deductible ?? true);
      } else {
        setExpenseType('variable');
        setVariableCategory(expense.category as VariableExpenseCategory);
        setCalculationType(expense.calculation_type);
        setLinkedRevenueStreamId(expense.linked_revenue_stream_id || '');
        setPercentage(expense.percentage);
        setPercentageRaw(expense.percentage ? expense.percentage.toString().replace('.', ',') : '');
        setUnitCost(expense.unit_cost);
        setUnitCostRaw(expense.unit_cost ? expense.unit_cost.toString().replace('.', ',') : '');
        setVatRate(expense.vat_rate);
        setIsVatDeductible(expense.is_vat_deductible);
        setIsCogs(expense.is_cogs ?? true);
        setPcgSubcategory((expense as any).pcg_subcategory || '');
      }
    } else {
      // Reset form
      setExpenseType('fixed');
      setName('');
      setStartDate(getDefaultStartDate());
      setEndDate('');
      setNotes('');
      setVatRate(0.20);
      setIsVatDeductible(true);
      // Fixed defaults
      setFixedCategory('other');
      setAmount('');
      setPaymentFrequency('monthly');
      setPaymentMonths([]);
      setPcgSubcategory('none');
      // Variable defaults
      setVariableCategory('cogs');
      setCalculationType('percentage');
      setLinkedRevenueStreamId('');
      setPercentage(0);
      setPercentageRaw('');
      setUnitCost(0);
      setUnitCostRaw('');
      setIsCogs(true);
    }
  }, [expense, open, settings.bp_start_date]);

  // Auto-select first PCG subcategory when category changes (fixed or variable)
  useEffect(() => {
    if (expenseType === 'fixed') {
      const subs = PCG_SUBCATEGORIES[fixedCategory] || [];
      if (!expense && subs.length > 0) {
        setPcgSubcategory(subs[0].code);
      } else if (!expense) {
        setPcgSubcategory('');
      }
    }
  }, [fixedCategory, expense, expenseType]);

  useEffect(() => {
    if (expenseType === 'variable') {
      const subs = PCG_VARIABLE_SUBCATEGORIES[variableCategory] || [];
      if (!expense && subs.length > 0) {
        setPcgSubcategory(subs[0].code);
      } else if (!expense) {
        setPcgSubcategory('');
      }
    }
  }, [variableCategory, expense, expenseType]);

  // Update payment months when frequency changes
  useEffect(() => {
    if (!expense) {
      setPaymentMonths(DEFAULT_PAYMENT_MONTHS[paymentFrequency]);
    }
  }, [paymentFrequency, expense]);

  const toggleMonth = (month: number) => {
    setPaymentMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  const handleSave = () => {
    if (expenseType === 'fixed') {
      const subs = PCG_SUBCATEGORIES[fixedCategory] || [];
      if (subs.length > 0 && (!pcgSubcategory || pcgSubcategory === 'none')) {
        return;
      }
      const amountValue = parseFloat(amount) || 0;
      onSaveFixed({
        id: expense?.expenseType === 'fixed' ? expense.id : undefined,
        name,
        category: fixedCategory,
        monthly_amount: amountValue,
        start_date: startDate,
        end_date: endDate || null,
        notes: notes || null,
        payment_frequency: paymentFrequency,
        payment_months: paymentFrequency !== 'monthly' ? paymentMonths : null,
        pcg_subcategory: pcgSubcategory && pcgSubcategory !== 'none' ? pcgSubcategory : null,
        vat_rate: vatRate,
        is_vat_deductible: isVatDeductible,
      });
    } else {
      const varSubs = PCG_VARIABLE_SUBCATEGORIES[variableCategory] || [];
      if (varSubs.length > 0 && (!pcgSubcategory || pcgSubcategory === 'none')) {
        return;
      }
      onSaveVariable({
        id: expense?.expenseType === 'variable' ? expense.id : undefined,
        name,
        category: variableCategory,
        calculation_type: calculationType,
        linked_revenue_stream_id: linkedRevenueStreamId || null,
        percentage: calculationType === 'percentage' ? percentage : 0,
        unit_cost: calculationType === 'per_unit' ? unitCost : 0,
        vat_rate: vatRate,
        is_vat_deductible: isVatDeductible,
        is_cogs: isCogs,
        start_date: startDate,
        end_date: endDate || null,
        notes: notes || null,
        pcg_subcategory: pcgSubcategory && pcgSubcategory !== 'none' ? pcgSubcategory : null,
      });
    }
    onOpenChange(false);
  };

  const availablePcgSubcategories = PCG_SUBCATEGORIES[fixedCategory] || [];
  const frequencyInfo = PAYMENT_FREQUENCIES[paymentFrequency];
  const amountValue = parseFloat(amount) || 0;
  const monthlyEquivalent = amountValue / frequencyInfo.multiplier;

  const isEditing = !!expense;
  const canChangeType = !isEditing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {expense ? 'Modifier la charge' : 'Nouvelle charge'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Nom de la charge</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={expenseType === 'fixed' ? "Ex: Loyer bureau" : "Ex: Commission commerciale"}
            />
          </div>

          {/* Type Toggle */}
          <div className="grid gap-2">
            <Label>Type de charge</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={expenseType === 'fixed' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => canChangeType && setExpenseType('fixed')}
                disabled={!canChangeType}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Fixe
              </Button>
              <Button
                type="button"
                variant={expenseType === 'variable' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => canChangeType && setExpenseType('variable')}
                disabled={!canChangeType}
              >
                <Percent className="h-4 w-4 mr-2" />
                Variable
              </Button>
            </div>
            {!canChangeType && (
              <p className="text-xs text-muted-foreground">
                Le type ne peut pas être modifié après création
              </p>
            )}
          </div>

          {/* FIXED EXPENSE FIELDS */}
          {expenseType === 'fixed' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Catégorie</Label>
                  <Select value={fixedCategory} onValueChange={(v) => setFixedCategory(v as FixedExpenseCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FIXED_EXPENSE_CATEGORIES).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Périodicité</Label>
                  <Select value={paymentFrequency} onValueChange={(v) => setPaymentFrequency(v as PaymentFrequency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_FREQUENCIES).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {availablePcgSubcategories.length > 0 && (
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    Compte PCG
                    <span className="text-xs text-destructive font-normal">*</span>
                  </Label>
                  <Select value={pcgSubcategory} onValueChange={setPcgSubcategory}>
                    <SelectTrigger className={!pcgSubcategory || pcgSubcategory === 'none' ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Sélectionner un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePcgSubcategories.map(({ code, label }) => (
                        <SelectItem key={code} value={code}>
                          {code} - {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(!pcgSubcategory || pcgSubcategory === 'none') && (
                    <p className="text-xs text-destructive">Le compte PCG est obligatoire</p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="amount">
                  Montant par {frequencyInfo.label.toLowerCase()} (€)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
                {paymentFrequency !== 'monthly' && amountValue > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Équivalent mensuel : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monthlyEquivalent)}
                  </p>
                )}
              </div>

              {paymentFrequency !== 'monthly' && (
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Mois de paiement
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {MONTH_NAMES.map((month, index) => {
                      const monthNum = index + 1;
                      const isSelected = paymentMonths.includes(monthNum);
                      return (
                        <Badge
                          key={month}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => toggleMonth(monthNum)}
                        >
                          {month}
                        </Badge>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sélectionnez les mois où cette charge est décaissée
                  </p>
                </div>
              )}
            </>
          )}

          {/* VARIABLE EXPENSE FIELDS */}
          {expenseType === 'variable' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Catégorie</Label>
                  <Select value={variableCategory} onValueChange={(v) => setVariableCategory(v as VariableExpenseCategory)}>
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
                <div className="grid gap-2">
                  <Label>Flux de revenus lié</Label>
                  <Select value={linkedRevenueStreamId || 'all'} onValueChange={(v) => setLinkedRevenueStreamId(v === 'all' ? '' : v)}>
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
              </div>

              {/* PCG Subcategory for variable expenses */}
              {(PCG_VARIABLE_SUBCATEGORIES[variableCategory] || []).length > 0 && (
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    Compte PCG
                    <span className="text-xs text-destructive font-normal">*</span>
                  </Label>
                  <Select value={pcgSubcategory} onValueChange={setPcgSubcategory}>
                    <SelectTrigger className={!pcgSubcategory || pcgSubcategory === 'none' ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Sélectionner un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {(PCG_VARIABLE_SUBCATEGORIES[variableCategory] || []).map(({ code, label }) => (
                        <SelectItem key={code} value={code}>
                          {code} - {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(!pcgSubcategory || pcgSubcategory === 'none') && (
                    <p className="text-xs text-destructive">Le compte PCG est obligatoire</p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label>Type de calcul</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={calculationType === 'percentage' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setCalculationType('percentage')}
                  >
                    <Percent className="h-4 w-4 mr-2" />
                    % du CA
                  </Button>
                  <Button
                    type="button"
                    variant={calculationType === 'per_unit' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setCalculationType('per_unit')}
                  >
                    <Hash className="h-4 w-4 mr-2" />
                    €/unité
                  </Button>
                </div>
              </div>

              {calculationType === 'percentage' ? (
                <div className="grid gap-2">
                  <Label htmlFor="percentage">Pourcentage du CA (%)</Label>
                  <Input
                    id="percentage"
                    type="text"
                    inputMode="decimal"
                    value={percentageRaw}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                        setPercentageRaw(raw);
                        const normalized = raw.replace(',', '.');
                        const parsed = parseFloat(normalized);
                        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                          setPercentage(parsed);
                        } else if (raw === '') {
                          setPercentage(0);
                        }
                      }
                    }}
                    placeholder="Ex: 0,8"
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="unitCost">Coût par unité (€)</Label>
                  <Input
                    id="unitCost"
                    type="text"
                    inputMode="decimal"
                    value={unitCostRaw}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                        setUnitCostRaw(raw);
                        const normalized = raw.replace(',', '.');
                        const parsed = parseFloat(normalized);
                        if (!isNaN(parsed) && parsed >= 0) {
                          setUnitCost(parsed);
                        } else if (raw === '') {
                          setUnitCost(0);
                        }
                      }
                    }}
                    placeholder="Ex: 1,50"
                  />
                </div>
              )}

              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Label htmlFor="isCogs" className="cursor-pointer font-medium">
                      Coût des ventes (impacte la marge brute)
                    </Label>
                    <span className="text-xs text-muted-foreground mt-1">
                      {isCogs 
                        ? "Cette charge est déduite du CA pour calculer la marge brute" 
                        : "Cette charge est une charge d'exploitation (après marge brute)"}
                    </span>
                  </div>
                  <Switch
                    id="isCogs"
                    checked={isCogs}
                    onCheckedChange={setIsCogs}
                  />
                </div>
              </div>
            </>
          )}

          {/* COMMON FIELDS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Date de début</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">Date de fin (optionnel)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vatRate">Taux de TVA</Label>
              <Select
                value={VAT_RATES.find(r => parseFloat(r.value) === vatRate)?.value || '0.20'}
                onValueChange={(v) => setVatRate(parseFloat(v))}
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
                id="isVatDeductible"
                checked={isVatDeductible}
                onCheckedChange={setIsVatDeductible}
              />
              <Label htmlFor="isVatDeductible" className="cursor-pointer">
                TVA déductible
              </Label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Détails supplémentaires..."
              rows={2}
            />
          </div>

          {/* Summary for fixed expenses */}
          {expenseType === 'fixed' && amountValue > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant {frequencyInfo.label.toLowerCase()}</span>
                <span className="font-medium text-destructive">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amountValue)}
                </span>
              </div>
              {paymentFrequency !== 'monthly' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coût mensuel (lissé)</span>
                    <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monthlyEquivalent)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coût annuel</span>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(monthlyEquivalent * 12)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isLoading || (expenseType === 'fixed' && !amount)}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {expense ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
