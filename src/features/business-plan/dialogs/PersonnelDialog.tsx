import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, Info, User, Briefcase, Upload, FileCheck, Loader2, AlertCircle } from 'lucide-react';
import { BPPersonnel, WorkerType } from '@/hooks/useBPPersonnel';
import { format } from 'date-fns';
import { 
  calculateDetailedCharges, 
  CONTRACT_TYPES as FRENCH_CONTRACT_TYPES, 
  COMPANY_SIZES,
  URSSAF_RATES_2026 
} from '@/lib/french-rates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';
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

interface PersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel?: BPPersonnel | null;
  onSave: (data: Partial<BPPersonnel>) => void;
  defaultWorkerType?: WorkerType;
}

export function PersonnelDialog({ open, onOpenChange, personnel, onSave, defaultWorkerType = 'employee' }: PersonnelDialogProps) {
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

  const [workerType, setWorkerType] = useState<WorkerType>(defaultWorkerType);
  const [position, setPosition] = useState('');
  const [grossSalary, setGrossSalary] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
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

  useEffect(() => {
    if (personnel) {
      setWorkerType(personnel.worker_type || 'employee');
      setPosition(personnel.position);
      setGrossSalary(Math.round(personnel.gross_salary * 12).toString());
      setDailyRate(personnel.daily_rate?.toString() || '');
      setEstimatedDays(personnel.estimated_days_per_month?.toString() || '');
      setStartDate(personnel.start_date);
      setEndDate(personnel.end_date || '');
      setNotes(personnel.notes || '');
      setContractType(personnel.contract_type || 'cdi');
      setIsExecutive(personnel.is_executive ?? false);
      setCompanySize(personnel.company_size || 'small');
      // Restore imported data if exists
      if (personnel.payslip_imported) {
        setCustomMutuelle(personnel.mutuelle_employer_amount);
        setCustomAtMpRate(personnel.at_mp_rate);
        setCustomChargesRate(personnel.employer_charges_rate);
      }
    } else {
      // Reset ALL state for new personnel
      setWorkerType(defaultWorkerType);
      setPosition('');
      setGrossSalary('');
      setDailyRate('');
      setEstimatedDays('20');
      setStartDate(getDefaultStartDate());
      setEndDate('');
      setNotes('');
      setContractType(defaultWorkerType === 'freelance' ? 'freelance' : 'cdi');
      setIsExecutive(false);
      setCompanySize('small');
      setShowDetails(false);
      setImportedData(null);
      setCustomMutuelle(null);
      setCustomAtMpRate(null);
      setCustomChargesRate(null);
    }
  }, [personnel, open, defaultWorkerType, settings.bp_start_date, settings.fiscal_year_start_month, settings.fiscal_year_start_day]);

  const isFreelance = workerType === 'freelance';
  
  // Calculs pour les salariés
  const grossSalaryAnnual = parseFloat(grossSalary) || 0;
  const grossSalaryMonthly = grossSalaryAnnual / 12;
  const detailedCharges = calculateDetailedCharges(
    grossSalaryMonthly,
    isExecutive,
    companySize as 'small' | 'medium' | 'large',
    contractType
  );
  
  // Use imported charges rate if available
  const effectiveChargesTotal = customChargesRate && grossSalaryMonthly > 0 
    ? grossSalaryMonthly * customChargesRate 
    : detailedCharges.total;
  const effectiveRate = customChargesRate 
    ? customChargesRate * 100 
    : (grossSalaryMonthly > 0 ? (detailedCharges.total / grossSalaryMonthly * 100) : 0);
  
  const totalEmployeeCostMonthly = grossSalaryMonthly + effectiveChargesTotal;

  // Calculs pour les freelances
  const dailyRateValue = parseFloat(dailyRate) || 0;
  const estimatedDaysValue = parseFloat(estimatedDays) || 0;
  const totalFreelanceCostMonthly = dailyRateValue * estimatedDaysValue;

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
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('parse-payslip', {
        body: { pdf_base64: base64 }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const payslipData = data as PayslipImportData;
      setImportedData(payslipData);

      // Pre-fill form fields
      // Note: PersonnelDialog doesn't have a name field, name is stored via position
      if (payslipData.position) setPosition(payslipData.position);
      if (payslipData.gross_salary_monthly) {
        setGrossSalary(Math.round(payslipData.gross_salary_monthly * 12).toString());
      }
      if (payslipData.start_date) {
        setStartDate(payslipData.start_date);
      }
      setIsExecutive(payslipData.is_executive);
      if (payslipData.contract_type) {
        const mappedType = payslipData.contract_type === 'interim' ? 'cdd' : payslipData.contract_type;
        setContractType(mappedType);
      }

      // Set custom values from payslip
      if (payslipData.mutuelle_employer) {
        setCustomMutuelle(payslipData.mutuelle_employer);
      }
      if (payslipData.at_mp_rate) {
        setCustomAtMpRate(payslipData.at_mp_rate);
      }
      if (payslipData.employer_charges_rate) {
        setCustomChargesRate(payslipData.employer_charges_rate);
      }

      toast.success('Fiche de paie importée ! Vérifiez les valeurs pré-remplies.');
    } catch (error) {
      logError('Payslip import error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'import');
    } finally {
      setIsImporting(false);
      // Reset file input
      e.target.value = '';
    }
  }, []);

  const handleSave = () => {
    if (isFreelance) {
      onSave({
        id: personnel?.id,
        position,
        worker_type: 'freelance',
        daily_rate: dailyRateValue,
        estimated_days_per_month: estimatedDaysValue,
        start_date: startDate,
        end_date: endDate || null,
        notes: notes || null,
        contract_type: 'freelance',
      });
    } else {
      onSave({
        id: personnel?.id,
        position,
        worker_type: workerType,
        gross_salary: grossSalaryMonthly,
        employer_charges_rate: customChargesRate ?? undefined,
        start_date: startDate,
        end_date: endDate || null,
        notes: notes || null,
        contract_type: contractType,
        is_executive: isExecutive,
        company_size: companySize,
        // Payslip import fields
        mutuelle_employer_amount: customMutuelle,
        at_mp_rate: customAtMpRate,
        payslip_imported: !!importedData || personnel?.payslip_imported,
      });
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{personnel ? 'Modifier le membre' : 'Nouveau membre'}</DialogTitle>
        </DialogHeader>
        
        <Tabs value={workerType} onValueChange={(v) => setWorkerType(v as WorkerType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="employee" className="gap-2">
              <User className="h-4 w-4" />
              Salarié
            </TabsTrigger>
            <TabsTrigger value="freelance" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Freelance
            </TabsTrigger>
          </TabsList>

          <div className="grid gap-4 py-4">
            {/* Payslip upload zone - only for new employees */}
            {!personnel && workerType === 'employee' && (
              <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                importedData 
                  ? 'border-green-500/50 bg-green-500/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}>
                {isImporting ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Analyse en cours...</span>
                  </div>
                ) : importedData ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <FileCheck className="h-5 w-5" />
                      <span className="font-medium">Fiche importée</span>
                      {importedData.period && (
                        <span className="text-sm text-muted-foreground">({importedData.period})</span>
                      )}
                    </div>
                    {importedData.confidence_score < 0.7 && (
                      <div className="flex items-center justify-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        <span>Confiance moyenne - vérifiez les valeurs</span>
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setImportedData(null);
                        setCustomMutuelle(null);
                        setCustomAtMpRate(null);
                        setCustomChargesRate(null);
                      }}
                    >
                      Réinitialiser
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Importez une fiche de paie PDF pour pré-remplir automatiquement
                    </p>
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={handlePayslipUpload}
                      className="hidden"
                      id="payslip-upload"
                    />
                    <Button variant="outline" size="sm" asChild>
                      <label htmlFor="payslip-upload" className="cursor-pointer">
                        Parcourir
                      </label>
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Le fichier est analysé puis supprimé (RGPD)
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="position">{isFreelance ? 'Mission / Prestation' : 'Intitulé du poste'}</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder={isFreelance ? "Ex: Développement application mobile" : "Ex: Développeur Full Stack"}
              />
            </div>

            <TabsContent value="employee" className="mt-0 space-y-4">
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

              {/* Aperçu des coûts salarié */}
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
                    <CollapsibleContent className="mt-2 space-y-1">
                      {customChargesRate && (
                        <div className="mb-2 p-2 bg-green-500/10 rounded text-xs text-green-700">
                          Taux importé depuis la fiche de paie ({(customChargesRate * 100).toFixed(1)}%)
                        </div>
                      )}
                      <div className="pl-3 border-l-2 border-muted space-y-1">
                        {chargesBreakdown.map(charge => (
                          <div key={charge.label} className="flex justify-between text-xs text-muted-foreground">
                            <span>{charge.label} ({(charge.rate * 100).toFixed(2)}%)</span>
                            <span>{formatCurrency(charge.value)}</span>
                          </div>
                        ))}
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
            </TabsContent>

            <TabsContent value="freelance" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dailyRate">TJM - Taux Journalier (€)</Label>
                  <Input
                    id="dailyRate"
                    type="number"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    placeholder="Ex: 500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="estimatedDays">Jours estimés / mois</Label>
                  <Input
                    id="estimatedDays"
                    type="number"
                    value={estimatedDays}
                    onChange={(e) => setEstimatedDays(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>

              {/* Aperçu des coûts freelance */}
              {dailyRateValue > 0 && estimatedDaysValue > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TJM × {estimatedDaysValue} jours</span>
                    <span>{formatCurrency(dailyRateValue)} × {estimatedDaysValue}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Coût mensuel estimé</span>
                    <span className="text-destructive">{formatCurrency(totalFreelanceCostMonthly)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    soit {formatCurrency(totalFreelanceCostMonthly * 12)}/an (si constant)
                  </div>
                </div>
              )}
            </TabsContent>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">{isFreelance ? 'Date de début mission' : "Date d'embauche"}</Label>
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
                placeholder="Informations complémentaires..."
                rows={2}
              />
            </div>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!position.trim() || (isFreelance ? !dailyRate : !grossSalary)}
          >
            {personnel ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
