import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Financing } from '@/hooks/useFinancings';
import { useInvestments } from '@/hooks/useInvestments';
import { FINANCING_TYPES, calculateLoanPayment } from '@/lib/french-rates';
import { format, addMonths } from 'date-fns';
import { Landmark, FileText } from 'lucide-react';
import { useBPSettings } from '@/features/business-plan/hooks/useBPSettings';

interface FinancingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  financing?: Financing | null;
  onSave: (data: Partial<Financing>) => void;
}

export function FinancingDialog({ open, onOpenChange, financing, onSave }: FinancingDialogProps) {
  const { investments } = useInvestments();
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

  const [financingType, setFinancingType] = useState<'loan' | 'lease' | 'current_account'>('loan');
  const [name, setName] = useState('');
  const [investmentId, setInvestmentId] = useState<string>('none');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('3.5');
  const [durationMonths, setDurationMonths] = useState('60');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (financing) {
      setFinancingType(financing.financing_type);
      setName(financing.name);
      setInvestmentId(financing.investment_id || 'none');
      setAmount(financing.amount.toString());
      setInterestRate(financing.interest_rate.toString());
      setDurationMonths(financing.duration_months.toString());
      setMonthlyPayment(financing.monthly_payment.toString());
      setStartDate(financing.start_date);
      setEndDate(financing.end_date || '');
      setNotes(financing.notes || '');
    } else {
      setFinancingType('loan');
      setName('');
      setInvestmentId('none');
      setAmount('');
      setInterestRate('3.5');
      setDurationMonths('60');
      setMonthlyPayment('');
      setStartDate(getDefaultStartDate());
      setEndDate('');
      setNotes('');
    }
  }, [financing, open, settings.bp_start_date, settings.fiscal_year_start_month, settings.fiscal_year_start_day]);

  // Auto-calculate loan monthly payment
  useEffect(() => {
    if (financingType === 'loan') {
      const amountNum = parseFloat(amount) || 0;
      const rateNum = parseFloat(interestRate) || 0;
      const durationNum = parseInt(durationMonths) || 60;
      
      if (amountNum > 0) {
        const { monthlyPayment: calculated } = calculateLoanPayment(amountNum, rateNum, durationNum);
        setMonthlyPayment(calculated.toFixed(2));
      }
    }
  }, [financingType, amount, interestRate, durationMonths]);

  // Auto-calculate end date for leasing
  useEffect(() => {
    if (financingType === 'lease' && startDate && durationMonths) {
      const end = addMonths(new Date(startDate), parseInt(durationMonths) || 0);
      setEndDate(format(end, 'yyyy-MM-dd'));
    }
  }, [financingType, startDate, durationMonths]);

  const amountNum = parseFloat(amount) || 0;
  const rateNum = parseFloat(interestRate) || 0;
  const durationNum = parseInt(durationMonths) || 60;
  const monthlyPaymentNum = parseFloat(monthlyPayment) || 0;

  // Calculate loan totals for preview
  const loanInfo = financingType === 'loan' 
    ? calculateLoanPayment(amountNum, rateNum, durationNum)
    : null;

  // Calculate lease totals for preview
  const leaseTotalCost = financingType === 'lease' 
    ? monthlyPaymentNum * durationNum
    : 0;

  const handleSave = () => {
    const calculatedEndDate = endDate || format(addMonths(new Date(startDate), durationNum), 'yyyy-MM-dd');
    
    onSave({
      id: financing?.id,
      financing_type: financingType,
      name,
      investment_id: investmentId === 'none' ? null : investmentId,
      amount: amountNum,
      interest_rate: rateNum,
      duration_months: durationNum,
      monthly_payment: monthlyPaymentNum,
      start_date: startDate,
      end_date: calculatedEndDate,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{financing ? 'Modifier le financement' : 'Nouveau financement'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Financing Type Selector */}
          <div className="grid gap-2">
            <Label>Type de financement</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={financingType === 'loan' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setFinancingType('loan')}
              >
                <Landmark className="h-4 w-4" />
                Emprunt
              </Button>
              <Button
                type="button"
                variant={financingType === 'lease' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setFinancingType('lease')}
              >
                <FileText className="h-4 w-4" />
                Leasing
              </Button>
              <Button
                type="button"
                variant={financingType === 'current_account' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setFinancingType('current_account')}
              >
                <Landmark className="h-4 w-4" />
                Compte courant
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nom du financement</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={financingType === 'loan' ? 'Ex: Crédit véhicule BNP' : 'Ex: LOA véhicule commercial'}
            />
          </div>

          <div className="grid gap-2">
            <Label>Lier à un investissement (optionnel)</Label>
            <Select value={investmentId} onValueChange={setInvestmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun investissement lié" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun investissement lié</SelectItem>
                {investments.map(inv => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {financingType === 'loan' ? (
            // Loan-specific fields
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Montant emprunté (€)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rate">Taux d'intérêt annuel (%)</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="3.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="duration">Durée (mois)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    placeholder="60"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Date de déblocage</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Loan Preview */}
              {amountNum > 0 && loanInfo && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mensualité</span>
                    <span className="font-medium">{formatCurrency(loanInfo.monthlyPayment)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coût total du crédit</span>
                    <span>{formatCurrency(loanInfo.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-destructive">
                    <span>dont intérêts</span>
                    <span>{formatCurrency(loanInfo.totalInterest)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Fin du remboursement</span>
                    <span className="font-medium">{format(addMonths(new Date(startDate), durationNum), 'MMMM yyyy')}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Lease-specific fields
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="monthlyLease">Loyer mensuel HT (€)</Label>
                  <Input
                    id="monthlyLease"
                    type="number"
                    value={monthlyPayment}
                    onChange={(e) => setMonthlyPayment(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="duration">Durée (mois)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    placeholder="36"
                  />
                </div>
              </div>

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
                  <Label htmlFor="endDate">Date de fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Lease Preview */}
              {monthlyPaymentNum > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Loyer mensuel</span>
                    <span className="font-medium">{formatCurrency(monthlyPaymentNum)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coût total du leasing</span>
                    <span className="font-medium">{formatCurrency(leaseTotalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Fin du contrat</span>
                    <span className="font-medium">{format(addMonths(new Date(startDate), durationNum), 'MMMM yyyy')}</span>
                  </div>
                </div>
              )}

              {/* Hidden amount field for leasing (set to 0) */}
              <input type="hidden" value="0" />
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations complémentaires..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || (financingType === 'loan' ? !amount : !monthlyPayment)}>
            {financing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
