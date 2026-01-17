import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useBPSettings } from '@/hooks/useBPSettings';
import { Package, Wallet } from 'lucide-react';

interface BPSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BPSettingsDialog({ open, onOpenChange }: BPSettingsDialogProps) {
  const { settings, updateSettings } = useBPSettings();
  const [initialCash, setInitialCash] = useState('');
  const [customerDelay, setCustomerDelay] = useState('');
  const [supplierDelay, setSupplierDelay] = useState('');
  const [projectionMonths, setProjectionMonths] = useState('');
  const [showStocks, setShowStocks] = useState(true);
  const [showFinancing, setShowFinancing] = useState(true);

  useEffect(() => {
    if (settings) {
      setInitialCash(settings.initial_cash.toString());
      setCustomerDelay(settings.customer_payment_delay.toString());
      setSupplierDelay(settings.supplier_payment_delay.toString());
      setProjectionMonths(settings.projection_months.toString());
      setShowStocks(settings.show_stocks ?? true);
      setShowFinancing(settings.show_financing ?? true);
    }
  }, [settings, open]);

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      initial_cash: parseFloat(initialCash) || 0,
      customer_payment_delay: parseInt(customerDelay) || 30,
      supplier_payment_delay: parseInt(supplierDelay) || 30,
      projection_months: parseInt(projectionMonths) || 24,
      show_stocks: showStocks,
      show_financing: showFinancing,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Paramètres du Business Plan</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
            <div className="grid gap-2">
              <Label htmlFor="projectionMonths">Horizon de projection (mois)</Label>
              <Input
                id="projectionMonths"
                type="number"
                value={projectionMonths}
                onChange={(e) => setProjectionMonths(e.target.value)}
                placeholder="24"
                min="12"
                max="60"
              />
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
