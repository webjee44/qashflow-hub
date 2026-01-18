import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Briefcase } from 'lucide-react';
import { BPPersonnel } from '@/hooks/useBPPersonnel';
import { format } from 'date-fns';

interface FreelanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freelance?: BPPersonnel | null;
  onSave: (data: Partial<BPPersonnel>) => void;
}

export function FreelanceDialog({ open, onOpenChange, freelance, onSave }: FreelanceDialogProps) {
  const [position, setPosition] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('20');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // Reset form when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      if (freelance) {
        setPosition(freelance.position);
        setDailyRate(freelance.daily_rate?.toString() || '');
        setEstimatedDays(freelance.estimated_days_per_month?.toString() || '20');
        setStartDate(freelance.start_date);
        setEndDate(freelance.end_date || '');
        setNotes(freelance.notes || '');
      } else {
        setPosition('');
        setDailyRate('');
        setEstimatedDays('20');
        setStartDate(format(new Date(), 'yyyy-MM-dd'));
        setEndDate('');
        setNotes('');
      }
    }
    onOpenChange(isOpen);
  }, [freelance, onOpenChange]);

  const dailyRateValue = parseFloat(dailyRate) || 0;
  const estimatedDaysValue = parseFloat(estimatedDays) || 0;
  const totalMonthlyCost = dailyRateValue * estimatedDaysValue;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const handleSave = () => {
    onSave({
      id: freelance?.id,
      position,
      worker_type: 'freelance',
      daily_rate: dailyRateValue,
      estimated_days_per_month: estimatedDaysValue,
      start_date: startDate,
      end_date: endDate || null,
      notes: notes || null,
      contract_type: 'freelance',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-orange-500" />
            {freelance ? 'Modifier le freelance' : 'Nouveau freelance'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="position">Mission / Prestation</Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Ex: Développement application mobile"
            />
          </div>

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

          {/* Aperçu des coûts */}
          {dailyRateValue > 0 && estimatedDaysValue > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TJM × {estimatedDaysValue} jours</span>
                <span>{formatCurrency(dailyRateValue)} × {estimatedDaysValue}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Coût mensuel estimé</span>
                <span className="text-destructive">{formatCurrency(totalMonthlyCost)}</span>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                soit {formatCurrency(totalMonthlyCost * 12)}/an (si constant)
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Date de début mission</Label>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!position.trim() || !dailyRate}
          >
            {freelance ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
