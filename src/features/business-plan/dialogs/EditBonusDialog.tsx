// ============================================
// Dialog: EditBonusDialog
// Modifier ou supprimer une prime existante
// ============================================

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Gift, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { BONUS_TYPES, BonusType, BPBonus, BPBonusUpdate } from '@/services/bonusService';

interface EditBonusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bonus: BPBonus | null;
  onUpdate: (id: string, data: BPBonusUpdate) => void;
  onDelete: (id: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function EditBonusDialog({
  open,
  onOpenChange,
  bonus,
  onUpdate,
  onDelete,
  isUpdating = false,
  isDeleting = false,
}: EditBonusDialogProps) {
  const [bonusType, setBonusType] = useState<BonusType>('ppv');
  const [amount, setAmount] = useState<string>('');
  const [paymentMonth, setPaymentMonth] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Initialiser les valeurs quand le bonus change
  useEffect(() => {
    if (bonus) {
      setBonusType(bonus.bonus_type as BonusType);
      setAmount(bonus.amount.toString());
      setPaymentMonth(bonus.payment_month);
      setNotes(bonus.notes || '');
    }
  }, [bonus]);

  // Générer les mois disponibles (12 mois avant et après)
  const availableMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = -12; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        value: format(date, 'yyyy-MM-dd'),
        label: format(date, 'MMMM yyyy', { locale: fr }),
      });
    }
    return months;
  }, []);

  const handleSubmit = () => {
    if (!bonus) return;
    
    const isExempt = BONUS_TYPES[bonusType].exempt;
    
    onUpdate(bonus.id, {
      bonus_type: bonusType,
      amount: parseFloat(amount) || 0,
      payment_month: paymentMonth,
      is_exempt: isExempt,
      notes: notes || null,
    });
    
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!bonus) return;
    onDelete(bonus.id);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

  if (!bonus) return null;

  const isExempt = BONUS_TYPES[bonusType].exempt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Modifier la prime
          </DialogTitle>
          <DialogDescription>
            Modifiez les détails de cette prime
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type de prime */}
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

          {/* Montant */}
          <div className="space-y-2">
            <Label>Montant</Label>
            <Input
              type="number"
              min="0"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 1000"
            />
          </div>

          {/* Mois de versement */}
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

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarques sur cette prime..."
              rows={2}
            />
          </div>

          {/* Info exonération */}
          {isExempt && (
            <div className="p-3 rounded-lg bg-emerald-500/10 text-sm text-emerald-600 dark:text-emerald-400">
              ✓ Cette prime est exonérée de cotisations sociales
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette prime ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. La prime de {formatCurrency(parseFloat(amount) || 0)} sera définitivement supprimée.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isUpdating || !amount}>
              {isUpdating ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
