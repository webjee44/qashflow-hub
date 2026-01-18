import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBPSettings } from '@/hooks/useBPSettings';
import { Package, Wallet, Calendar, Building2 } from 'lucide-react';

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

// BP duration is fixed at 3 years for simplicity

const TAX_REGIMES = [
  { value: 'is', label: 'IS - Impôt sur les Sociétés', description: 'SAS, SASU, SARL soumises à l\'IS' },
  { value: 'ir', label: 'IR - Impôt sur le Revenu', description: 'EI, EURL, SASU à l\'IR' },
  { value: 'micro', label: 'Micro-entreprise', description: 'Auto-entrepreneur, micro-BIC/BNC' },
];

const LEGAL_FORMS = [
  { value: 'sas', label: 'SAS' },
  { value: 'sasu', label: 'SASU' },
  { value: 'sarl', label: 'SARL' },
  { value: 'eurl', label: 'EURL' },
  { value: 'ei', label: 'EI' },
  { value: 'micro', label: 'Micro-entreprise' },
  { value: 'sa', label: 'SA' },
  { value: 'other', label: 'Autre' },
];

interface BPSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BPSettingsDialog({ open, onOpenChange }: BPSettingsDialogProps) {
  const { settings, updateSettings } = useBPSettings();
  const [bpStartDate, setBpStartDate] = useState('');
  // BP duration is fixed at 3 years
  const bpYears = 3;
  const [fiscalMonth, setFiscalMonth] = useState(1);
  const [initialCash, setInitialCash] = useState('');
  const [customerDelay, setCustomerDelay] = useState('');
  const [supplierDelay, setSupplierDelay] = useState('');
  const [taxRegime, setTaxRegime] = useState('is');
  const [isPme, setIsPme] = useState(true);
  const [showStocks, setShowStocks] = useState(true);
  const [showFinancing, setShowFinancing] = useState(true);

  useEffect(() => {
    if (settings) {
      setBpStartDate(settings.bp_start_date || new Date().toISOString().split('T')[0]);
      // bpYears is now fixed at 3
      setFiscalMonth(settings.fiscal_year_start_month || 1);
      setInitialCash(settings.initial_cash.toString());
      setCustomerDelay(settings.customer_payment_delay.toString());
      setSupplierDelay(settings.supplier_payment_delay.toString());
      setTaxRegime(settings.tax_regime || 'is');
      setIsPme(settings.is_pme ?? true);
      setShowStocks(settings.show_stocks ?? true);
      setShowFinancing(settings.show_financing ?? true);
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
      bp_start_date: bpStartDate,
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
              <Calendar className="h-4 w-4" />
              Exercice comptable
            </h4>
            
            <div className="grid gap-2">
              <Label htmlFor="bpStartDate">Date de début du Business Plan</Label>
              <Input
                id="bpStartDate"
                type="date"
                value={bpStartDate}
                onChange={(e) => setBpStartDate(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="fiscalMonth">Début d'exercice</Label>
              <Select value={fiscalMonth.toString()} onValueChange={(v) => setFiscalMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_REGIMES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span>{r.label}</span>
                      </div>
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
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="showFinancing" className="font-medium cursor-pointer">
                    Financements à venir
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Activer le plan de financement (emprunts, apports, etc.)
                  </p>
                </div>
              </div>
              <Switch
                id="showFinancing"
                checked={showFinancing}
                onCheckedChange={setShowFinancing}
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
                type="number"
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
                  type="number"
                  value={customerDelay}
                  onChange={(e) => setCustomerDelay(e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplierDelay">Délai fournisseurs (jours)</Label>
                <Input
                  id="supplierDelay"
                  type="number"
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
