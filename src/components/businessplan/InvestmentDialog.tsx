import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Investment } from '@/hooks/useInvestments';
import { INVESTMENT_CATEGORIES, calculateMonthlyDepreciation } from '@/lib/french-rates';
import { format, addMonths } from 'date-fns';

interface InvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment?: Investment | null;
  onSave: (data: Partial<Investment>) => void;
}

export function InvestmentDialog({ open, onOpenChange, investment, onSave }: InvestmentDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('equipment');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [depreciationYears, setDepreciationYears] = useState('5');
  const [depreciationMethod, setDepreciationMethod] = useState('linear');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (investment) {
      setName(investment.name);
      setCategory(investment.category);
      setPurchaseDate(investment.purchase_date);
      setPurchaseAmount(investment.purchase_amount.toString());
      setDepreciationYears(investment.depreciation_years.toString());
      setDepreciationMethod(investment.depreciation_method);
      setNotes(investment.notes || '');
    } else {
      setName('');
      setCategory('equipment');
      setPurchaseDate(format(new Date(), 'yyyy-MM-dd'));
      setPurchaseAmount('');
      setDepreciationYears('5');
      setDepreciationMethod('linear');
      setNotes('');
    }
  }, [investment, open]);

  // Auto-set default years when category changes
  useEffect(() => {
    if (!investment) {
      const cat = INVESTMENT_CATEGORIES.find(c => c.value === category);
      if (cat) {
        setDepreciationYears(cat.defaultYears.toString());
      }
    }
  }, [category, investment]);

  const purchaseAmountNum = parseFloat(purchaseAmount) || 0;
  const depreciationYearsNum = parseInt(depreciationYears) || 5;
  
  const monthlyDepreciation = calculateMonthlyDepreciation(
    purchaseAmountNum,
    depreciationYearsNum,
    depreciationMethod as 'linear' | 'degressive'
  );
  
  const annualDepreciation = monthlyDepreciation * 12;
  const endDate = addMonths(new Date(purchaseDate), depreciationYearsNum * 12);

  const handleSave = () => {
    onSave({
      id: investment?.id,
      name,
      category,
      purchase_date: purchaseDate,
      purchase_amount: purchaseAmountNum,
      depreciation_years: depreciationYearsNum,
      depreciation_method: depreciationMethod,
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
          <DialogTitle>{investment ? 'Modifier l\'investissement' : 'Nouvel investissement'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nom de l'immobilisation</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: MacBook Pro 16 pouces"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {INVESTMENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purchaseDate">Date d'acquisition</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Montant HT (€)</Label>
              <Input
                id="amount"
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="years">Durée d'amortissement (années)</Label>
              <Input
                id="years"
                type="number"
                min="1"
                max="30"
                value={depreciationYears}
                onChange={(e) => setDepreciationYears(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Mode d'amortissement</Label>
            <Select value={depreciationMethod} onValueChange={setDepreciationMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="linear">Linéaire</SelectItem>
                <SelectItem value="degressive">Dégressif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {purchaseAmountNum > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valeur d'acquisition</span>
                <span className="font-medium">{formatCurrency(purchaseAmountNum)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dotation mensuelle</span>
                <span>{formatCurrency(monthlyDepreciation)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dotation annuelle</span>
                <span>{formatCurrency(annualDepreciation)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">Fin d'amortissement</span>
                <span className="font-medium">{format(endDate, 'MMMM yyyy')}</span>
              </div>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !purchaseAmount}>
            {investment ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
