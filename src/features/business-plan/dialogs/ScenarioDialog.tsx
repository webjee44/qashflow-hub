import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Scenario } from '@/hooks/useScenarios';

interface ScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario?: Scenario | null;
  onSave: (data: Partial<Scenario>) => void;
}

const COLORS = [
  { value: 'hsl(142, 70%, 45%)', label: 'Vert' },
  { value: 'hsl(220, 70%, 50%)', label: 'Bleu' },
  { value: 'hsl(270, 70%, 50%)', label: 'Violet' },
  { value: 'hsl(340, 70%, 50%)', label: 'Rose' },
  { value: 'hsl(0, 70%, 50%)', label: 'Rouge' },
  { value: 'hsl(45, 70%, 50%)', label: 'Jaune' },
];

export function ScenarioDialog({ open, onOpenChange, scenario, onSave }: ScenarioDialogProps) {
  const [name, setName] = useState('');
  const [revenueMultiplier, setRevenueMultiplier] = useState(100);
  const [expenseMultiplier, setExpenseMultiplier] = useState(100);
  const [color, setColor] = useState(COLORS[0].value);

  useEffect(() => {
    if (scenario) {
      setName(scenario.name);
      setRevenueMultiplier(Number(scenario.revenue_multiplier) * 100);
      setExpenseMultiplier(Number(scenario.expense_multiplier) * 100);
      setColor(scenario.color || COLORS[0].value);
    } else {
      setName('');
      setRevenueMultiplier(100);
      setExpenseMultiplier(100);
      setColor(COLORS[0].value);
    }
  }, [scenario, open]);

  const handleSave = () => {
    onSave({
      id: scenario?.id,
      name,
      revenue_multiplier: revenueMultiplier / 100,
      expense_multiplier: expenseMultiplier / 100,
      color,
    });
    onOpenChange(false);
  };

  const formatPercent = (value: number) => {
    const diff = value - 100;
    if (diff === 0) return '0%';
    return `${diff > 0 ? '+' : ''}${diff}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{scenario ? 'Modifier le scénario' : 'Nouveau scénario'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nom du scénario</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Croissance forte"
            />
          </div>

          <div className="grid gap-2">
            <Label>Couleur</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex justify-between items-center">
              <Label>Variation des revenus</Label>
              <span className={`font-semibold ${revenueMultiplier >= 100 ? 'text-success' : 'text-destructive'}`}>
                {formatPercent(revenueMultiplier)}
              </span>
            </div>
            <Slider
              value={[revenueMultiplier]}
              onValueChange={([v]) => setRevenueMultiplier(v)}
              min={50}
              max={200}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-50%</span>
              <span>Base</span>
              <span>+100%</span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex justify-between items-center">
              <Label>Variation des charges</Label>
              <span className={`font-semibold ${expenseMultiplier <= 100 ? 'text-success' : 'text-destructive'}`}>
                {formatPercent(expenseMultiplier)}
              </span>
            </div>
            <Slider
              value={[expenseMultiplier]}
              onValueChange={([v]) => setExpenseMultiplier(v)}
              min={50}
              max={200}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-50%</span>
              <span>Base</span>
              <span>+100%</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {scenario ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
