import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Info, User, Upload, FileCheck, Loader2, AlertCircle, FileText, Settings, DoorOpen, Calculator } from 'lucide-react';
import { BPPersonnel, DEPARTURE_TYPES, DepartureType } from '@/hooks/useBPPersonnel';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  calculateDetailedCharges, 
  CONTRACT_TYPES as FRENCH_CONTRACT_TYPES, 
  COMPANY_SIZES,
  URSSAF_RATES_2026,
  calculateSeveranceEmployerCost
} from '@/lib/french-rates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBPSettings } from '@/features/business-plan/hooks/useBPSettings';

interface PayslipImportData {
  gross_salary_monthly: number;
  net_salary?: number;
  position?: string;
  is_executive: boolean;
  contract_type: 'cdi' | 'cdd' | 'interim' | 'apprentice';
  employer_charges_total?: number;
  employer_charges_rate?: number;
  mutuelle_employer?: number;
  at_mp_rate?: number;
  period?: string;
  employee_name?: string;
  start_date?: string;
  confidence_score: number;
}

type DialogStep = 'choice' | 'import' | 'form';

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: BPPersonnel | null;
  onSave: (data: Partial<BPPersonnel>) => void;
}

export function EmployeeDialog({ open, onOpenChange, employee, onSave }: EmployeeDialogProps) {
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

  // Step management - show choice only for new employees
  const [step, setStep] = useState<DialogStep>('choice');
  
  // Form state
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [grossSalary, setGrossSalary] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [contractType, setContractType] = useState('cdi');
  const [isExecutive, setIsExecutive] = useState(false);
  const [companySize, setCompanySize] = useState('small');
  const [showDetails, setShowDetails] = useState(false);
  
  // Payslip import state
  const [isImporting, setIsImporting] = useState(false);
  const [importedData, setImportedData] = useState<PayslipImportData | null>(null);
  const [customMutuelle, setCustomMutuelle] = useState<number | null>(null);
  const [customAtMpRate, setCustomAtMpRate] = useState<number | null>(null);
  const [customChargesRate, setCustomChargesRate] = useState<number | null>(null);

  // Departure state
  const [departureType, setDepartureType] = useState<DepartureType | null>(null);
  const [severanceAmount, setSeveranceAmount] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      if (employee) {
        // Edit mode - go directly to form
        setStep('form');
        setName(employee.name || '');
        setPosition(employee.position);
        setGrossSalary(Math.round(employee.gross_salary * 12).toString());
        setStartDate(employee.start_date);
        setEndDate(employee.end_date || '');
        setNotes(employee.notes || '');
        setContractType(employee.contract_type || 'cdi');
        setIsExecutive(employee.is_executive ?? false);
        setCompanySize(employee.company_size || 'small');
        setDepartureType(employee.departure_type || null);
        setSeveranceAmount(employee.severance_amount?.toString() || '');
        if (employee.payslip_imported) {
          setCustomMutuelle(employee.mutuelle_employer_amount);
          setCustomAtMpRate(employee.at_mp_rate);
          setCustomChargesRate(employee.employer_charges_rate);
        }
      } else {
        // New employee - show choice and reset ALL state
        setStep('choice');
        setName('');
        setPosition('');
        setGrossSalary('');
        setStartDate(getDefaultStartDate());
        setEndDate('');
        setNotes('');
        setContractType('cdi');
        setIsExecutive(false);
        setCompanySize('small');
        setShowDetails(false);
        setImportedData(null);
        setCustomMutuelle(null);
        setCustomAtMpRate(null);
        setCustomChargesRate(null);
        setDepartureType(null);
        setSeveranceAmount('');
      }
    }
  }, [open, employee, settings.bp_start_date, settings.fiscal_year_start_month, settings.fiscal_year_start_day]);

  // Calculations
  const grossSalaryAnnual = parseFloat(grossSalary) || 0;
  const grossSalaryMonthly = grossSalaryAnnual / 12;
  const detailedCharges = calculateDetailedCharges(
    grossSalaryMonthly,
    isExecutive,
    companySize as 'small' | 'medium' | 'large',
    contractType
  );
  
  const effectiveChargesTotal = customChargesRate && grossSalaryMonthly > 0 
    ? grossSalaryMonthly * customChargesRate 
    : detailedCharges.total;
  const effectiveRate = customChargesRate 
    ? customChargesRate * 100 
    : (grossSalaryMonthly > 0 ? (detailedCharges.total / grossSalaryMonthly * 100) : 0);
  
  const totalEmployeeCostMonthly = grossSalaryMonthly + effectiveChargesTotal;

  // Severance calculations
  const selectedDepartureConfig = departureType ? DEPARTURE_TYPES[departureType] : null;
  const showSeveranceField = selectedDepartureConfig?.hasSeverance ?? false;
  const severanceAmountNum = parseFloat(severanceAmount) || 0;
  const severanceCost = useMemo(() => {
    if (!showSeveranceField || severanceAmountNum <= 0) return null;
    return calculateSeveranceEmployerCost(severanceAmountNum, selectedDepartureConfig?.employerContributionRate);
  }, [showSeveranceField, severanceAmountNum, selectedDepartureConfig]);

  // File upload handler
  const handlePayslipUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    setIsImporting(true);

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('parse-payslip', {
        body: { pdf_base64: base64 }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const payslipData = data as PayslipImportData;
      console.log('Payslip data received:', JSON.stringify(payslipData));
      setImportedData(payslipData);

      // Pre-fill name and start date from payslip
      if (payslipData.employee_name) {
        console.log('Setting name to:', payslipData.employee_name);
        setName(payslipData.employee_name);
      }
      if (payslipData.position) setPosition(payslipData.position);
      if (payslipData.gross_salary_monthly) {
        setGrossSalary(Math.round(payslipData.gross_salary_monthly * 12).toString());
      }
      if (payslipData.start_date) {
        console.log('Setting start date to:', payslipData.start_date);
        setStartDate(payslipData.start_date);
      }
      setIsExecutive(payslipData.is_executive);
      if (payslipData.contract_type) {
        const mappedType = payslipData.contract_type === 'interim' ? 'cdd' : payslipData.contract_type;
        setContractType(mappedType);
      }

      if (payslipData.mutuelle_employer) setCustomMutuelle(payslipData.mutuelle_employer);
      if (payslipData.at_mp_rate) setCustomAtMpRate(payslipData.at_mp_rate);
      if (payslipData.employer_charges_rate) setCustomChargesRate(payslipData.employer_charges_rate);

      toast.success('Fiche de paie importée ! Vérifiez les valeurs.');
      setStep('form');
    } catch (error) {
      console.error('Payslip import error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'import');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  }, []);

  // Reset departure type when end date is cleared
  useEffect(() => {
    if (!endDate) {
      setDepartureType(null);
      setSeveranceAmount('');
    }
  }, [endDate]);

  const handleSave = () => {
    onSave({
      id: employee?.id,
      name: name || null,
      position,
      worker_type: 'employee',
      gross_salary: grossSalaryMonthly,
      employer_charges_rate: customChargesRate ?? undefined,
      start_date: startDate,
      end_date: endDate || null,
      notes: notes || null,
      contract_type: contractType,
      is_executive: isExecutive,
      company_size: companySize,
      mutuelle_employer_amount: customMutuelle,
      at_mp_rate: customAtMpRate,
      payslip_imported: !!importedData || employee?.payslip_imported,
      // Departure fields
      departure_type: endDate ? departureType : null,
      severance_amount: showSeveranceField && severanceAmountNum > 0 ? severanceAmountNum : null,
    });
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const chargesBreakdown = [
    { label: 'Maladie (base)', value: detailedCharges.maladieBase, rate: URSSAF_RATES_2026.employer.maladie_base },
    ...(isExecutive ? [
      { label: 'Maladie complément (cadre)', value: detailedCharges.maladieComplementCadre, rate: URSSAF_RATES_2026.employer.maladie_complement_cadre },
    ] : []),
    { label: 'CSA', value: detailedCharges.csa, rate: URSSAF_RATES_2026.employer.csa },
    { label: 'Vieillesse déplafonnée', value: detailedCharges.vieillesseDeplafonnee, rate: URSSAF_RATES_2026.employer.vieillesse_deplafonnee },
    { label: 'Vieillesse plafonnée', value: detailedCharges.vieillessePlafonnee, rate: grossSalaryMonthly > 0 ? detailedCharges.vieillessePlafonnee / grossSalaryMonthly : 0 },
    { label: 'Alloc. familiales', value: detailedCharges.allocationsFamiliales, rate: grossSalaryMonthly > 0 ? detailedCharges.allocationsFamiliales / grossSalaryMonthly : 0 },
    { label: 'Chômage', value: detailedCharges.chomage, rate: URSSAF_RATES_2026.employer.chomage },
    { label: 'AGS', value: detailedCharges.ags, rate: URSSAF_RATES_2026.employer.ags },
    { label: 'FNAL', value: detailedCharges.fnal, rate: grossSalaryMonthly > 0 ? detailedCharges.fnal / grossSalaryMonthly : 0 },
    { label: 'Formation', value: detailedCharges.formation, rate: grossSalaryMonthly > 0 ? detailedCharges.formation / grossSalaryMonthly : 0 },
    { label: 'Taxe apprentissage', value: detailedCharges.apprentissage, rate: URSSAF_RATES_2026.employer.apprentissage },
    { label: 'AT/MP', value: detailedCharges.atMp, rate: customAtMpRate ?? URSSAF_RATES_2026.employer.at_mp.avg },
    { label: 'Retraite compl. T1', value: detailedCharges.retraiteComplementaireT1, rate: URSSAF_RATES_2026.employer.retraite_complementaire.tranche1 },
    ...(isExecutive ? [
      { label: 'Retraite compl. T2 (cadre)', value: detailedCharges.retraiteComplementaireT2, rate: URSSAF_RATES_2026.employer.retraite_complementaire.tranche2 },
      { label: 'APEC (cadre)', value: detailedCharges.apec, rate: URSSAF_RATES_2026.employer.apec },
      { label: 'Prévoyance cadre', value: detailedCharges.prevoyanceCadre, rate: URSSAF_RATES_2026.employer.prevoyance_cadre },
    ] : []),
    { label: 'CET', value: detailedCharges.cet, rate: URSSAF_RATES_2026.employer.cet },
    { label: 'Mutuelle (forfait)', value: customMutuelle ?? detailedCharges.mutuelle, rate: grossSalaryMonthly > 0 ? (customMutuelle ?? detailedCharges.mutuelle) / grossSalaryMonthly : 0 },
  ].filter(c => c.value > 0);

  // Render choice step
  if (step === 'choice') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Nouveau salarié
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Comment souhaitez-vous ajouter ce salarié ?
            </p>
            
            {/* Option 1: Import PDF */}
            <div 
              className="border-2 border-dashed rounded-lg p-5 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer group"
              onClick={() => document.getElementById('payslip-upload-choice')?.click()}
            >
              {isImporting ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Analyse en cours...</span>
                </div>
              ) : (
                <>
                  <FileText className="h-10 w-10 mx-auto text-primary/60 group-hover:text-primary mb-3" />
                  <p className="font-medium">Importer une fiche de paie</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pré-remplit automatiquement avec les vraies valeurs
                  </p>
                  <input 
                    type="file" 
                    accept=".pdf"
                    onChange={handlePayslipUpload}
                    className="hidden"
                    id="payslip-upload-choice"
                  />
                </>
              )}
            </div>

            {/* Option 2: Manual */}
            <div 
              className="border rounded-lg p-5 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer group"
              onClick={() => setStep('form')}
            >
              <Settings className="h-10 w-10 mx-auto text-muted-foreground group-hover:text-primary mb-3" />
              <p className="font-medium">Configurer manuellement</p>
              <p className="text-sm text-muted-foreground mt-1">
                Saisir les informations du salarié
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Render form step
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {employee ? 'Modifier le salarié' : 'Nouveau salarié'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Imported data badge */}
          {importedData && (
            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <FileCheck className="h-5 w-5" />
                <span className="font-medium">Données importées</span>
                {importedData.period && (
                  <span className="text-sm text-muted-foreground">({importedData.period})</span>
                )}
              </div>
              {importedData.confidence_score < 0.7 && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>Vérifiez les valeurs</span>
                </div>
              )}
            </div>
          )}

          {/* Nom et Poste */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom du salarié</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Jean Dupont"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position">Intitulé du poste</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ex: Développeur Full Stack"
              />
            </div>
          </div>

          {/* Paramètres URSSAF */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Type de contrat</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRENCH_CONTRACT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Taille de l'entreprise</Label>
              <Select value={companySize} onValueChange={setCompanySize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map(size => (
                    <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Label htmlFor="executive" className="font-normal">Statut cadre</Label>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <Switch
              id="executive"
              checked={isExecutive}
              onCheckedChange={setIsExecutive}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="salary">Salaire brut annuel (€)</Label>
              <Input
                id="salary"
                type="number"
                value={grossSalary}
                onChange={(e) => setGrossSalary(e.target.value)}
                placeholder="Ex: 35000"
              />
              {grossSalaryAnnual > 0 && (
                <span className="text-xs text-muted-foreground">
                  soit {formatCurrency(grossSalaryMonthly)}/mois
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Taux charges patronales</Label>
              <div className={`h-9 flex items-center px-3 rounded-md text-sm font-medium ${
                customChargesRate ? 'bg-green-500/10 text-green-700' : 'bg-muted/50'
              }`}>
                {effectiveRate.toFixed(1)}% {customChargesRate ? '(importé)' : '(calculé)'}
              </div>
            </div>
          </div>

          {/* Aperçu des coûts */}
          {grossSalaryAnnual > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Salaire brut annuel</span>
                <span>{formatCurrency(grossSalaryAnnual)}</span>
              </div>
              
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span>Charges patronales ({effectiveRate.toFixed(1)}%)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{formatCurrency(effectiveChargesTotal)}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  {customChargesRate && (
                    <div className="p-2 bg-green-500/10 rounded text-xs text-green-700">
                      Taux importé depuis la fiche de paie ({(customChargesRate * 100).toFixed(1)}%)
                    </div>
                  )}
                  
                  {/* Mutuelle - Section dédiée */}
                  {(customMutuelle || detailedCharges.mutuelle > 0) && (
                    <div className="p-3 bg-blue-500/10 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <span className="text-sm font-medium text-blue-800">Mutuelle employeur</span>
                          {customMutuelle && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-700 rounded">
                              Importé
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-blue-800">
                          {formatCurrency(customMutuelle ?? detailedCharges.mutuelle)}/mois
                        </span>
                      </div>
                      {!customMutuelle && (
                        <p className="text-xs text-blue-600 mt-1">
                          Forfait estimé (50% part employeur)
                        </p>
                      )}
                    </div>
                  )}

                  {/* AT/MP - Section dédiée si importé */}
                  {customAtMpRate && (
                    <div className="p-3 bg-amber-500/10 border border-amber-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-amber-500 rounded-full" />
                          <span className="text-sm font-medium text-amber-800">AT/MP</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-700 rounded">
                            Importé
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-amber-800">
                          {(customAtMpRate * 100).toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">
                        Taux réel de votre entreprise
                      </p>
                    </div>
                  )}

                  {/* Autres cotisations */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Autres cotisations</p>
                    <div className="pl-3 border-l-2 border-muted space-y-1">
                      {chargesBreakdown
                        .filter(c => c.label !== 'Mutuelle (forfait)' && (!customAtMpRate || c.label !== 'AT/MP'))
                        .map(charge => (
                          <div key={charge.label} className="flex justify-between text-xs text-muted-foreground">
                            <span>{charge.label} ({(charge.rate * 100).toFixed(2)}%)</span>
                            <span>{formatCurrency(charge.value)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Coût total employeur</span>
                <span className="text-destructive">{formatCurrency(totalEmployeeCostMonthly)}/mois</span>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                soit {formatCurrency(totalEmployeeCostMonthly * 12)}/an
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Date d'embauche</Label>
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

          {/* Departure Section - Only visible when end date is set */}
          {endDate && (
            <div className="p-4 border rounded-lg space-y-4 bg-amber-500/5 border-amber-200">
              <div className="flex items-center gap-2 text-amber-700">
                <DoorOpen className="h-5 w-5" />
                <span className="font-medium">Conditions de départ</span>
              </div>

              <div className="grid gap-2">
                <Label>Type de départ</Label>
                <Select 
                  value={departureType || ''} 
                  onValueChange={(val) => setDepartureType(val as DepartureType || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez le type de départ" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEPARTURE_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDepartureConfig && (
                  <p className="text-xs text-muted-foreground">
                    {selectedDepartureConfig.description}
                  </p>
                )}
              </div>

              {/* Severance Amount - Only for departure types with severance */}
              {showSeveranceField && (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label htmlFor="severance">Indemnité brute négociée (€)</Label>
                    <Input
                      id="severance"
                      type="number"
                      value={severanceAmount}
                      onChange={(e) => setSeveranceAmount(e.target.value)}
                      placeholder="Ex: 8500"
                    />
                    <p className="text-xs text-muted-foreground">
                      Montant brut versé au salarié (hors charges employeur)
                    </p>
                  </div>

                  {/* Cost preview */}
                  {severanceCost && (
                    <div className="p-3 bg-background rounded-lg border space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calculator className="h-4 w-4 text-primary" />
                        Coût employeur estimé
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Indemnité brute</span>
                          <span>{formatCurrency(severanceCost.grossAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Forfait social ({((selectedDepartureConfig?.employerContributionRate || 0.20) * 100).toFixed(0)}%)
                          </span>
                          <span className="text-destructive">+ {formatCurrency(severanceCost.employerContribution)}</span>
                        </div>
                        <div className="flex justify-between font-semibold pt-1 border-t">
                          <span>Coût total employeur</span>
                          <span className="text-destructive">{formatCurrency(severanceCost.totalCost)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ℹ️ Versé en {endDate ? format(new Date(endDate), 'MMMM yyyy', { locale: fr }) : '–'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
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
          {!employee && (
            <Button variant="ghost" onClick={() => setStep('choice')} className="mr-auto">
              ← Retour
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!position.trim() || !grossSalary}
          >
            {employee ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
