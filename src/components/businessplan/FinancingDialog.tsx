import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Financing } from '@/hooks/useFinancings';
import { useInvestments } from '@/hooks/useInvestments';
import { useBPSettings } from '@/hooks/useBPSettings';
import { FINANCING_TYPES, calculateLoanPayment } from '@/lib/french-rates';
import { format, addMonths } from 'date-fns';
import { Landmark, FileText, FileUp, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AmortizationData {
  loan_name: string | null;
  bank_name: string | null;
  loan_reference: string | null;
  initial_amount: number;
  interest_rate: number | null;
  duration_months: number | null;
  monthly_payment: number | null;
  monthly_insurance: number | null;
  start_date: string | null;
  outstanding_capital: number | null;
  total_interest: number | null;
  loan_type: 'loan' | 'lease' | null;
  confidence_score: number;
}

interface FinancingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  financing?: Financing | null;
  onSave: (data: Partial<Financing>) => void;
}

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:application/pdf;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

export function FinancingDialog({ open, onOpenChange, financing, onSave }: FinancingDialogProps) {
  const { investments } = useInvestments();
  const { settings } = useBPSettings();
  
  // PDF parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<AmortizationData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Initialiser la date par défaut au premier rendu
  useEffect(() => {
    if (!startDate && !financing) {
      setStartDate(getDefaultStartDate());
    }
  }, [settings]);

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
      // Reset parsed data when editing existing
      setParsedData(null);
      setParseError(null);
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
      setParsedData(null);
      setParseError(null);
    }
  }, [financing, open, settings]);

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

  // Handle PDF file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      toast.error('Veuillez sélectionner un fichier PDF');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setParsedData(null);

    try {
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke('parse-amortization-schedule', {
        body: { pdf_base64: base64 }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setParsedData(data);
      toast.success('Tableau d\'amortissement analysé avec succès');
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      setParseError(err.message || 'Erreur lors de l\'analyse du PDF');
      toast.error('Erreur lors de l\'analyse du PDF');
    } finally {
      setIsParsing(false);
      // Reset the input
      e.target.value = '';
    }
  };

  // Apply parsed data to form
  const applyParsedData = () => {
    if (!parsedData) return;
    
    // Set financing type based on detected loan type
    if (parsedData.loan_type === 'lease') {
      setFinancingType('lease');
    } else {
      setFinancingType('loan');
    }
    
    // Build name from bank and loan name
    const loanName = parsedData.loan_name || 'Prêt';
    const bankName = parsedData.bank_name || '';
    setName(bankName ? `${loanName} - ${bankName}` : loanName);
    
    // Set amount
    if (parsedData.initial_amount > 0) {
      setAmount(parsedData.initial_amount.toString());
    }
    
    // Set interest rate
    if (parsedData.interest_rate != null) {
      setInterestRate(parsedData.interest_rate.toString());
    }
    
    // Set duration
    if (parsedData.duration_months != null) {
      setDurationMonths(parsedData.duration_months.toString());
    }
    
    // Set start date
    if (parsedData.start_date) {
      setStartDate(parsedData.start_date);
    }
    
    // Build notes with reference and bank info
    const noteParts: string[] = [];
    if (parsedData.loan_reference) {
      noteParts.push(`Réf: ${parsedData.loan_reference}`);
    }
    if (parsedData.bank_name) {
      noteParts.push(`Banque: ${parsedData.bank_name}`);
    }
    if (parsedData.monthly_insurance != null && parsedData.monthly_insurance > 0) {
      noteParts.push(`Assurance: ${parsedData.monthly_insurance.toFixed(2)} €/mois`);
    }
    if (noteParts.length > 0) {
      setNotes(noteParts.join('\n'));
    }
    
    toast.success('Valeurs appliquées au formulaire');
  };

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

  // Only show PDF import for new financings (not editing)
  const showPdfImport = !financing && financingType === 'loan';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{financing ? 'Modifier le financement' : 'Nouveau financement'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* PDF Import Section - Only for new loans */}
          {showPdfImport && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload-legacy"
                  disabled={isParsing}
                />
                <label htmlFor="pdf-upload-legacy" className={`cursor-pointer ${isParsing ? 'pointer-events-none' : ''}`}>
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">Analyse IA en cours...</p>
                      <p className="text-xs text-muted-foreground">Extraction des données du prêt</p>
                    </div>
                  ) : (
                    <>
                      <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Importer un tableau d'amortissement</p>
                      <p className="text-xs text-muted-foreground">PDF de votre banque (optionnel)</p>
                    </>
                  )}
                </label>
              </div>

              {/* Parsed Data Preview */}
              {parsedData && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">
                        Données extraites
                      </p>
                      {parsedData.confidence_score < 0.7 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          Confiance faible - vérifiez les valeurs
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-sm space-y-1 text-green-800 dark:text-green-300">
                    {parsedData.bank_name && (
                      <p><span className="text-muted-foreground">Banque:</span> {parsedData.bank_name}</p>
                    )}
                    {parsedData.loan_name && (
                      <p><span className="text-muted-foreground">Prêt:</span> {parsedData.loan_name}</p>
                    )}
                    <p><span className="text-muted-foreground">Montant:</span> {formatCurrency(parsedData.initial_amount)}</p>
                    {parsedData.interest_rate != null && (
                      <p><span className="text-muted-foreground">Taux:</span> {parsedData.interest_rate.toFixed(2)}%</p>
                    )}
                    {parsedData.duration_months != null && (
                      <p><span className="text-muted-foreground">Durée:</span> {parsedData.duration_months} mois</p>
                    )}
                    {parsedData.monthly_payment != null && (
                      <p><span className="text-muted-foreground">Mensualité:</span> {formatCurrency(parsedData.monthly_payment)}</p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 w-full"
                    onClick={applyParsedData}
                  >
                    Appliquer ces valeurs
                  </Button>
                </div>
              )}

              {/* Parse Error */}
              {parseError && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive">{parseError}</p>
                  <p className="text-xs text-muted-foreground mt-1">Vous pouvez saisir les valeurs manuellement ci-dessous.</p>
                </div>
              )}

              {/* Separator */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    ou saisissez manuellement
                  </span>
                </div>
              </div>
            </div>
          )}

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
