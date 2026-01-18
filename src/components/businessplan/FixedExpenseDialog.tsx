import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Info } from 'lucide-react';
import { 
  BPFixedExpense, 
  FIXED_EXPENSE_CATEGORIES, 
  PAYMENT_FREQUENCIES, 
  DEFAULT_PAYMENT_MONTHS,
  PaymentFrequency 
} from '@/hooks/useBPFixedExpenses';
import { format } from 'date-fns';

interface FixedExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: BPFixedExpense | null;
  onSave: (data: Partial<BPFixedExpense>) => void;
}

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function FixedExpenseDialog({ open, onOpenChange, expense, onSave }: FixedExpenseDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<keyof typeof FIXED_EXPENSE_CATEGORIES>('other');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('monthly');
  const [paymentMonths, setPaymentMonths] = useState<number[]>([]);

  useEffect(() => {
    if (expense) {
      setName(expense.name);
      setCategory(expense.category as keyof typeof FIXED_EXPENSE_CATEGORIES);
      setAmount(expense.monthly_amount.toString());
      setStartDate(expense.start_date);
      setEndDate(expense.end_date || '');
      setNotes(expense.notes || '');
      setPaymentFrequency(expense.payment_frequency || 'monthly');
      setPaymentMonths(expense.payment_months || DEFAULT_PAYMENT_MONTHS[expense.payment_frequency || 'monthly']);
    } else {
      setName('');
      setCategory('other');
      setAmount('');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate('');
      setNotes('');
      setPaymentFrequency('monthly');
      setPaymentMonths([]);
    }
  }, [expense, open]);

  // Mettre à jour les mois par défaut quand la fréquence change
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
    const amountValue = parseFloat(amount) || 0;
    
    onSave({
      id: expense?.id,
      name,
      category,
      monthly_amount: amountValue, // Le montant est stocké tel quel (montant par période)
      start_date: startDate,
      end_date: endDate || null,
      notes: notes || null,
      payment_frequency: paymentFrequency,
      payment_months: paymentFrequency !== 'monthly' ? paymentMonths : null,
    });
    onOpenChange(false);
  };

  const frequencyInfo = PAYMENT_FREQUENCIES[paymentFrequency];
  const amountValue = parseFloat(amount) || 0;
  const monthlyEquivalent = amountValue / frequencyInfo.multiplier;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{expense ? 'Modifier la charge' : 'Nouvelle charge fixe'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nom de la charge</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Loyer bureau"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
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

          {/* Sélection des mois de paiement pour les charges non mensuelles */}
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

          {/* Résumé */}
          {amountValue > 0 && (
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
          <Button onClick={handleSave} disabled={!name.trim() || !amount}>
            {expense ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
