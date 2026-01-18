import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, Info, User, Briefcase } from 'lucide-react';
import { BPPersonnel, WorkerType } from '@/hooks/useBPPersonnel';
import { format } from 'date-fns';
import { 
  calculateDetailedCharges, 
  CONTRACT_TYPES as FRENCH_CONTRACT_TYPES, 
  COMPANY_SIZES,
  URSSAF_RATES_2026 
} from '@/lib/french-rates';

interface PersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel?: BPPersonnel | null;
  onSave: (data: Partial<BPPersonnel>) => void;
  defaultWorkerType?: WorkerType;
}

export function PersonnelDialog({ open, onOpenChange, personnel, onSave, defaultWorkerType = 'employee' }: PersonnelDialogProps) {
  const [workerType, setWorkerType] = useState<WorkerType>(defaultWorkerType);
  const [position, setPosition] = useState('');
  const [grossSalary, setGrossSalary] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [contractType, setContractType] = useState('cdi');
  const [isExecutive, setIsExecutive] = useState(false);
  const [companySize, setCompanySize] = useState('small');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (personnel) {
      setWorkerType(personnel.worker_type || 'employee');
      setPosition(personnel.position);
      setGrossSalary((personnel.gross_salary * 12).toString());
      setDailyRate(personnel.daily_rate?.toString() || '');
      setEstimatedDays(personnel.estimated_days_per_month?.toString() || '');
      setStartDate(personnel.start_date);
      setEndDate(personnel.end_date || '');
      setNotes(personnel.notes || '');
      setContractType(personnel.contract_type || 'cdi');
      setIsExecutive(personnel.is_executive ?? false);
      setCompanySize(personnel.company_size || 'small');
    } else {
      setWorkerType(defaultWorkerType);
      setPosition('');
      setGrossSalary('');
      setDailyRate('');
      setEstimatedDays('20');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate('');
      setNotes('');
      setContractType(defaultWorkerType === 'freelance' ? 'freelance' : 'cdi');
      setIsExecutive(false);
      setCompanySize('small');
    }
  }, [personnel, open, defaultWorkerType]);

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
  const totalEmployeeCostMonthly = grossSalaryMonthly + detailedCharges.total;
  const effectiveRate = grossSalaryMonthly > 0 ? (detailedCharges.total / grossSalaryMonthly * 100) : 0;

  // Calculs pour les freelances
  const dailyRateValue = parseFloat(dailyRate) || 0;
  const estimatedDaysValue = parseFloat(estimatedDays) || 0;
  const totalFreelanceCostMonthly = dailyRateValue * estimatedDaysValue;

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
        start_date: startDate,
        end_date: endDate || null,
        notes: notes || null,
        contract_type: contractType,
        is_executive: isExecutive,
        company_size: companySize,
      });
    }
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const chargesBreakdown = [
    { label: 'Maladie', value: detailedCharges.maladie, rate: grossSalaryMonthly > 0 ? detailedCharges.maladie / grossSalaryMonthly : 0 },
    { label: 'CSA', value: detailedCharges.csa, rate: URSSAF_RATES_2026.employer.csa },
    { label: 'Vieillesse déplafonnée', value: detailedCharges.vieillesseDeplafonnee, rate: URSSAF_RATES_2026.employer.vieillesse_deplafonnee },
    { label: 'Vieillesse plafonnée', value: detailedCharges.vieillessePlafonnee, rate: grossSalaryMonthly > 0 ? detailedCharges.vieillessePlafonnee / grossSalaryMonthly : 0 },
    { label: 'Alloc. familiales', value: detailedCharges.allocationsFamiliales, rate: grossSalaryMonthly > 0 ? detailedCharges.allocationsFamiliales / grossSalaryMonthly : 0 },
    { label: 'Chômage', value: detailedCharges.chomage, rate: URSSAF_RATES_2026.employer.chomage },
    { label: 'AGS', value: detailedCharges.ags, rate: URSSAF_RATES_2026.employer.ags },
    { label: 'FNAL', value: detailedCharges.fnal, rate: grossSalaryMonthly > 0 ? detailedCharges.fnal / grossSalaryMonthly : 0 },
    { label: 'Formation', value: detailedCharges.formation, rate: grossSalaryMonthly > 0 ? detailedCharges.formation / grossSalaryMonthly : 0 },
    { label: 'Taxe apprentissage', value: detailedCharges.apprentissage, rate: URSSAF_RATES_2026.employer.apprentissage },
    { label: 'AT/MP', value: detailedCharges.atMp, rate: URSSAF_RATES_2026.employer.at_mp },
    { label: 'Retraite compl. T1', value: detailedCharges.retraiteComplementaireT1, rate: grossSalaryMonthly > 0 ? detailedCharges.retraiteComplementaireT1 / grossSalaryMonthly : 0 },
    ...(isExecutive ? [
      { label: 'Retraite compl. T2 (cadre)', value: detailedCharges.retraiteComplementaireT2, rate: grossSalaryMonthly > 0 ? detailedCharges.retraiteComplementaireT2 / grossSalaryMonthly : 0 },
      { label: 'Prévoyance cadre', value: detailedCharges.prevoyanceCadre, rate: grossSalaryMonthly > 0 ? detailedCharges.prevoyanceCadre / grossSalaryMonthly : 0 },
    ] : []),
    { label: 'CET', value: detailedCharges.cet, rate: URSSAF_RATES_2026.employer.cet },
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
                  <div className="h-9 flex items-center px-3 bg-muted/50 rounded-md text-sm font-medium">
                    {effectiveRate.toFixed(1)}% (calculé auto)
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
                        <span>Charges patronales URSSAF ({effectiveRate.toFixed(1)}%)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{formatCurrency(detailedCharges.total)}</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-1">
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
