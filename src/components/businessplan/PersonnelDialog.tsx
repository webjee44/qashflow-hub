import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Personnel } from '@/hooks/usePersonnel';
import { format } from 'date-fns';

interface PersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel?: Personnel | null;
  onSave: (data: Partial<Personnel>) => void;
}

export function PersonnelDialog({ open, onOpenChange, personnel, onSave }: PersonnelDialogProps) {
  const [position, setPosition] = useState('');
  const [grossSalary, setGrossSalary] = useState('');
  const [chargesRate, setChargesRate] = useState('45');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (personnel) {
      setPosition(personnel.position);
      setGrossSalary(personnel.gross_salary.toString());
      setChargesRate((Number(personnel.employer_charges_rate) * 100).toString());
      setStartDate(personnel.start_date);
      setEndDate(personnel.end_date || '');
      setNotes(personnel.notes || '');
    } else {
      setPosition('');
      setGrossSalary('');
      setChargesRate('45');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate('');
      setNotes('');
    }
  }, [personnel, open]);

  const grossSalaryNum = parseFloat(grossSalary) || 0;
  const chargesRateNum = parseFloat(chargesRate) / 100 || 0.45;
  const employerCharges = grossSalaryNum * chargesRateNum;
  const totalCost = grossSalaryNum + employerCharges;

  const handleSave = () => {
    onSave({
      id: personnel?.id,
      position,
      gross_salary: grossSalaryNum,
      employer_charges_rate: chargesRateNum,
      start_date: startDate,
      end_date: endDate || null,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{personnel ? 'Modifier le poste' : 'Nouveau poste'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="position">Intitulé du poste</Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Ex: Développeur Full Stack"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="salary">Salaire brut mensuel (€)</Label>
              <Input
                id="salary"
                type="number"
                value={grossSalary}
                onChange={(e) => setGrossSalary(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="charges">Taux charges patronales (%)</Label>
              <Input
                id="charges"
                type="number"
                value={chargesRate}
                onChange={(e) => setChargesRate(e.target.value)}
                placeholder="45"
              />
            </div>
          </div>

          {/* Cost preview */}
          {grossSalaryNum > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Salaire brut</span>
                <span>{grossSalaryNum.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Charges patronales ({chargesRate}%)</span>
                <span>{employerCharges.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Coût total employeur</span>
                <span className="text-destructive">{totalCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €/mois</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Date d'embauche</Label>
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
          <Button onClick={handleSave} disabled={!position.trim() || !grossSalary}>
            {personnel ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
