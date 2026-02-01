import { useState, useEffect } from 'react';
import { format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBPSettings } from '@/hooks/useBPSettings';
import { Package, Wallet, Calendar as CalendarIcon, Building2, Landmark, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
];

const TAX_REGIMES = [
  { value: 'is', label: 'IS - Impôt sur les Sociétés', description: 'SAS, SASU, SARL soumises à l\'IS' },
  { value: 'ir', label: 'IR - Impôt sur le Revenu', description: 'EI, EURL, SASU à l\'IR' },
  { value: 'micro', label: 'Micro-entreprise', description: 'Auto-entrepreneur, micro-BIC/BNC' },
];

interface BPSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BPSettingsDialog({ open, onOpenChange }: BPSettingsDialogProps) {
  const { settings, updateSettings } = useBPSettings();
  const [bpStartDate, setBpStartDate] = useState<Date | undefined>(undefined);
  const bpYears = 3;
  const [fiscalMonth, setFiscalMonth] = useState(1);
  const [initialCash, setInitialCash] = useState('0');
  const [customerDelay, setCustomerDelay] = useState('30');
  const [supplierDelay, setSupplierDelay] = useState('30');
  const [taxRegime, setTaxRegime] = useState('is');
  const [isPme, setIsPme] = useState(true);
  const [showStocks, setShowStocks] = useState(true);
  const [showFinancing, setShowFinancing] = useState(true);
  const [showFundingPlan, setShowFundingPlan] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (settings && open) {
      // Parse date from string to Date object
      if (settings.bp_start_date) {
        try {
          const parsed = parse(settings.bp_start_date, 'yyyy-MM-dd', new Date());
          setBpStartDate(parsed);
        } catch {
          setBpStartDate(new Date());
        }
      } else {
        setBpStartDate(new Date());
      }
      setFiscalMonth(settings.fiscal_year_start_month || 1);
      setInitialCash(String(settings.initial_cash ?? 0));
      setCustomerDelay(String(settings.customer_payment_delay ?? 30));
      setSupplierDelay(String(settings.supplier_payment_delay ?? 30));
      setTaxRegime(settings.tax_regime || 'is');
      setIsPme(settings.is_pme ?? true);
      setShowStocks(settings.show_stocks ?? true);
      setShowFinancing(settings.show_financing ?? true);
      setShowFundingPlan(settings.show_funding_plan ?? true);
    }
  }, [settings, open]);

  const getFiscalYearDisplay = () => {
    const startMonth = MONTHS.find(m => m.value === fiscalMonth)?.label || 'Janvier';
    const endMonthIndex = fiscalMonth === 1 ? 12 : fiscalMonth - 1;
    const endMonth = MONTHS.find(m => m.value === endMonthIndex)?.label || 'Décembre';
    return `${startMonth} à ${endMonth}`;
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      bp_start_date: bpStartDate ? format(bpStartDate, 'yyyy-MM-dd') : null,
      bp_years: bpYears,
      fiscal_year_start_month: fiscalMonth,
      fiscal_year_start_day: 1,
      initial_cash: parseFloat(initialCash) || 0,
      customer_payment_delay: parseInt(customerDelay) || 30,
      supplier_payment_delay: parseInt(supplierDelay) || 30,
      tax_regime: taxRegime,
      is_pme: isPme,
      show_stocks: showStocks,
      show_financing: showFinancing,
      show_funding_plan: showFundingPlan,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres du Business Plan</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Fiscal Year Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Exercice comptable
            </h4>
            
            <div className="grid gap-2">
              <Label>Date de début du Business Plan</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !bpStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bpStartDate ? format(bpStartDate, "d MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={bpStartDate}
                    onSelect={(date) => {
                      setBpStartDate(date);
                      setDatePickerOpen(false);
                    }}
                    defaultMonth={bpStartDate || new Date(2026, 0, 1)}
                    fromYear={2020}
                    toYear={2030}
                    initialFocus
                    locale={fr}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="fiscalMonth">Début d'exercice</Label>
              <Select value={String(fiscalMonth)} onValueChange={(v) => setFiscalMonth(parseInt(v))}>
                <SelectTrigger id="fiscalMonth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Exercice fiscal : {getFiscalYearDisplay()}
            </p>
          </div>

          <Separator />

          {/* Legal & Tax Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Statut juridique & fiscal
            </h4>
            
            <div className="grid gap-2">
              <Label htmlFor="taxRegime">Régime fiscal</Label>
              <Select value={taxRegime} onValueChange={setTaxRegime}>
                <SelectTrigger id="taxRegime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_REGIMES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TAX_REGIMES.find(r => r.value === taxRegime)?.description}
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label htmlFor="isPme" className="font-medium cursor-pointer">
                  PME au sens communautaire
                </Label>
                <p className="text-xs text-muted-foreground">
                  Moins de 250 salariés, CA &lt; 50M€ ou bilan &lt; 43M€
                </p>
              </div>
              <Switch
                id="isPme"
                checked={isPme}
                onCheckedChange={setIsPme}
              />
            </div>
          </div>

          <Separator />

          {/* Modules Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Modules actifs</h4>
            
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="showStocks" className="font-medium cursor-pointer">
                    Gestion des stocks
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Activer le suivi des stocks et achats de marchandises
                  </p>
                </div>
              </div>
              <Switch
                id="showStocks"
                checked={showStocks}
                onCheckedChange={setShowStocks}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="showFinancing" className="font-medium cursor-pointer">
                    Financements
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Gérer les emprunts, apports en capital et subventions
                  </p>
                </div>
              </div>
              <Switch
                id="showFinancing"
                checked={showFinancing}
                onCheckedChange={setShowFinancing}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="showFundingPlan" className="font-medium cursor-pointer">
                    Plan de financement
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Tableau des besoins et ressources sur plusieurs années
                  </p>
                </div>
              </div>
              <Switch
                id="showFundingPlan"
                checked={showFundingPlan}
                onCheckedChange={setShowFundingPlan}
              />
            </div>
          </div>

          <Separator />

          {/* Treasury Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Paramètres de trésorerie</h4>
            
            <div className="grid gap-2">
              <Label htmlFor="initialCash">Trésorerie initiale (€)</Label>
              <Input
                id="initialCash"
                type="text"
                inputMode="decimal"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customerDelay">Délai clients (jours)</Label>
                <Input
                  id="customerDelay"
                  type="text"
                  inputMode="numeric"
                  value={customerDelay}
                  onChange={(e) => setCustomerDelay(e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplierDelay">Délai fournisseurs (jours)</Label>
                <Input
                  id="supplierDelay"
                  type="text"
                  inputMode="numeric"
                  value={supplierDelay}
                  onChange={(e) => setSupplierDelay(e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
