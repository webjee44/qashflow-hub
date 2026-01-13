import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBPSettings } from '@/hooks/useBPSettings';

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

  useEffect(() => {
    if (settings) {
      setInitialCash(settings.initial_cash.toString());
      setCustomerDelay(settings.customer_payment_delay.toString());
      setSupplierDelay(settings.supplier_payment_delay.toString());
      setProjectionMonths(settings.projection_months.toString());
    }
  }, [settings, open]);

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      initial_cash: parseFloat(initialCash) || 0,
      customer_payment_delay: parseInt(customerDelay) || 30,
      supplier_payment_delay: parseInt(supplierDelay) || 30,
      projection_months: parseInt(projectionMonths) || 24,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Paramètres de trésorerie</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="initialCash">Trésorerie initiale (€)</Label>
            <Input
              id="initialCash"
              type="number"
              value={initialCash}
              onChange={(e) => setInitialCash(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Solde de départ pour le calcul de la trésorerie prévisionnelle
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customerDelay">Délai de paiement clients (jours)</Label>
            <Input
              id="customerDelay"
              type="number"
              value={customerDelay}
              onChange={(e) => setCustomerDelay(e.target.value)}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground">
              Délai moyen avant de recevoir les paiements de vos clients
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplierDelay">Délai de paiement fournisseurs (jours)</Label>
            <Input
              id="supplierDelay"
              type="number"
              value={supplierDelay}
              onChange={(e) => setSupplierDelay(e.target.value)}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground">
              Délai moyen avant de payer vos fournisseurs
            </p>
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
