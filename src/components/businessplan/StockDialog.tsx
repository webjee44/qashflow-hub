import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stock } from '@/hooks/useStocks';
import { useBPSettings } from '@/hooks/useBPSettings';
import { Package, TrendingDown, TrendingUp } from 'lucide-react';

interface StockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock?: Stock | null;
  onSave: (data: Partial<Stock>) => void;
}

export function StockDialog({ open, onOpenChange, stock, onSave }: StockDialogProps) {
  const { settings } = useBPSettings();
  
  const [name, setName] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [purchaseAmount, setPurchaseAmount] = useState('0');
  const [finalStock, setFinalStock] = useState('0');
  const [fiscalYear, setFiscalYear] = useState('1');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (stock) {
      setName(stock.name);
      setInitialStock(stock.initial_stock.toString());
      setPurchaseAmount(stock.purchase_amount.toString());
      setFinalStock(stock.final_stock.toString());
      setFiscalYear(stock.fiscal_year.toString());
      setNotes(stock.notes || '');
    } else {
      setName('');
      setInitialStock('0');
      setPurchaseAmount('0');
      setFinalStock('0');
      setFiscalYear('1');
      setNotes('');
    }
  }, [stock, open]);

  const handleSave = () => {
    onSave({
      id: stock?.id,
      name,
      initial_stock: parseFloat(initialStock) || 0,
      purchase_amount: parseFloat(purchaseAmount) || 0,
      final_stock: parseFloat(finalStock) || 0,
      fiscal_year: parseInt(fiscalYear) || 1,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  // Calculate stock variation
  const initial = parseFloat(initialStock) || 0;
  const purchases = parseFloat(purchaseAmount) || 0;
  const final = parseFloat(finalStock) || 0;
  const variation = initial + purchases - final;
  const cogs = variation; // Cost of goods sold = variation positive

  const yearOptions = Array.from({ length: settings.bp_years || 3 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {stock ? 'Modifier le stock' : 'Nouveau stock'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nom du stock</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marchandises, Matières premières..."
            />
          </div>

          <div className="grid gap-2">
            <Label>Exercice fiscal</Label>
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    Année {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="initial">Stock initial (€)</Label>
              <Input
                id="initial"
                type="number"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purchases">Achats (€)</Label>
              <Input
                id="purchases"
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="final">Stock final (€)</Label>
              <Input
                id="final"
                type="number"
                value={finalStock}
                onChange={(e) => setFinalStock(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Variation de stock</span>
              <span className={`font-medium flex items-center gap-1 ${variation > 0 ? 'text-destructive' : variation < 0 ? 'text-success' : ''}`}>
                {variation > 0 ? <TrendingDown className="h-4 w-4" /> : variation < 0 ? <TrendingUp className="h-4 w-4" /> : null}
                {formatCurrency(Math.abs(variation))}
                {variation > 0 ? ' (destockage)' : variation < 0 ? ' (stockage)' : ''}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Coût d'achat des marchandises vendues</span>
              <span className="font-semibold">{formatCurrency(cogs)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              CAMV = Stock initial + Achats - Stock final
            </p>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {stock ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
