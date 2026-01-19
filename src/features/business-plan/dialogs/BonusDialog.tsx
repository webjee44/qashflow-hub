// ============================================
// Dialog: BonusDialog
// Saisie rapide des primes pour tous les salariés
// ============================================

import { useState, useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Gift, Info, Users, Check, Banknote } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BONUS_TYPES, BonusType, BPBonusInsert } from '@/services/bonusService';
import { BPPersonnel } from '@/services/personnelService';

interface BonusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel: BPPersonnel[];
  onSubmit: (bonuses: Omit<BPBonusInsert, 'user_id'>[]) => Promise<unknown>;
  isSubmitting?: boolean;
}

interface PersonnelBonusEntry {
  personnelId: string;
  selected: boolean;
  amount: number;
}

export function BonusDialog({
  open,
  onOpenChange,
  personnel,
  onSubmit,
  isSubmitting = false,
}: BonusDialogProps) {
  const [bonusType, setBonusType] = useState<BonusType>('ppv');
  const [paymentMonth, setPaymentMonth] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [uniformAmount, setUniformAmount] = useState<string>('');
  const [entries, setEntries] = useState<PersonnelBonusEntry[]>([]);

  // Filtrer seulement les salariés (pas les freelances)
  const employees = useMemo(() => 
    personnel.filter(p => p.worker_type === 'employee'),
    [personnel]
  );

  // Initialiser les entrées quand le dialog s'ouvre
  useMemo(() => {
    if (open && employees.length > 0 && entries.length === 0) {
      setEntries(
        employees.map(p => ({
          personnelId: p.id,
          selected: true,
          amount: 0,
        }))
      );
    }
  }, [open, employees, entries.length]);

  // Réinitialiser quand le dialog se ferme
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setEntries([]);
      setUniformAmount('');
      setBonusType('ppv');
    }
    onOpenChange(newOpen);
  };

  // Appliquer le même montant à tous
  const applyUniformAmount = () => {
    const amount = parseFloat(uniformAmount) || 0;
    setEntries(prev => prev.map(e => ({ ...e, amount })));
  };

  // Toggle sélection d'un salarié
  const toggleSelection = (personnelId: string) => {
    setEntries(prev =>
      prev.map(e =>
        e.personnelId === personnelId ? { ...e, selected: !e.selected } : e
      )
    );
  };

  // Mettre à jour le montant d'un salarié
  const updateAmount = (personnelId: string, amount: number) => {
    setEntries(prev =>
      prev.map(e =>
        e.personnelId === personnelId ? { ...e, amount } : e
      )
    );
  };

  // Sélectionner / désélectionner tous
  const toggleAll = () => {
    const allSelected = entries.every(e => e.selected);
    setEntries(prev => prev.map(e => ({ ...e, selected: !allSelected })));
  };

  // Calculs
  const selectedEntries = entries.filter(e => e.selected && e.amount > 0);
  const totalAmount = selectedEntries.reduce((sum, e) => sum + e.amount, 0);
  const isExempt = BONUS_TYPES[bonusType].exempt;

  // Générer les mois disponibles (12 prochains mois)
  const availableMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        value: format(date, 'yyyy-MM-dd'),
        label: format(date, 'MMMM yyyy', { locale: fr }),
      });
    }
    return months;
  }, []);

  // Soumission
  const handleSubmit = async () => {
    const bonuses = selectedEntries.map(entry => ({
      personnel_id: entry.personnelId,
      bonus_type: bonusType,
      amount: entry.amount,
      payment_month: paymentMonth,
      is_exempt: isExempt,
      notes: null,
    }));

    await onSubmit(bonuses);
    handleOpenChange(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Ajouter des primes
          </DialogTitle>
          <DialogDescription>
            Attribuez des primes à vos salariés en une seule opération
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Type de prime et mois */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type de prime</Label>
              <Select value={bonusType} onValueChange={(v) => setBonusType(v as BonusType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BONUS_TYPES).map(([key, { label, exempt }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {label}
                        {exempt && (
                          <Badge variant="secondary" className="text-xs">
                            Exonérée
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {BONUS_TYPES[bonusType].description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Mois de versement</Label>
              <Select value={paymentMonth} onValueChange={setPaymentMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Montant uniforme */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>Même montant pour tous</Label>
              <Input
                type="number"
                min="0"
                step="100"
                placeholder="Ex: 1000"
                value={uniformAmount}
                onChange={(e) => setUniformAmount(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={applyUniformAmount}
              disabled={!uniformAmount}
            >
              Appliquer
            </Button>
          </div>

          <Separator />

          {/* Liste des salariés */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Salariés ({employees.length})</span>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {entries.every(e => e.selected) ? 'Désélectionner tous' : 'Sélectionner tous'}
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {employees.map((person) => {
                const entry = entries.find(e => e.personnelId === person.id);
                if (!entry) return null;

                return (
                  <div
                    key={person.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                      entry.selected ? 'bg-muted/50 border-primary/20' : 'bg-background'
                    }`}
                  >
                    <Checkbox
                      checked={entry.selected}
                      onCheckedChange={() => toggleSelection(person.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{person.position}</p>
                      <p className="text-sm text-muted-foreground">
                        Salaire brut: {formatCurrency(person.gross_salary || 0)}
                      </p>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="Montant"
                        value={entry.amount || ''}
                        onChange={(e) => updateAmount(person.id, parseFloat(e.target.value) || 0)}
                        disabled={!entry.selected}
                        className="text-right"
                      />
                    </div>
                  </div>
                );
              })}

              {employees.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun salarié dans l'équipe</p>
                  <p className="text-sm">Ajoutez des salariés pour leur attribuer des primes</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Résumé */}
          {selectedEntries.length > 0 && (
            <>
              <Separator />
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {selectedEntries.length} salarié(s) sélectionné(s)
                  </span>
                  <span className="font-bold text-lg">{formatCurrency(totalAmount)}</span>
                </div>
                {isExempt && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" />
                    <span>Montant exonéré de charges : {formatCurrency(totalAmount)}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            La Prime de Partage de la Valeur (PPV) est exonérée de cotisations 
                            sociales jusqu'à 3 000€ par salarié (ou 6 000€ avec un accord 
                            d'intéressement ou de participation).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
                {!isExempt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Banknote className="h-4 w-4" />
                    <span>Soumis aux cotisations sociales</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedEntries.length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Enregistrement...' : `Enregistrer ${selectedEntries.length} prime(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
