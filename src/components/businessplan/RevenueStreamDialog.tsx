import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RevenueStream } from '@/hooks/useRevenueStreams';

interface RevenueStreamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stream?: RevenueStream | null;
  onSave: (data: Partial<RevenueStream>) => void;
}

const COLORS = [
  { value: 'hsl(142, 76%, 36%)', label: 'Vert' },
  { value: 'hsl(220, 70%, 50%)', label: 'Bleu' },
  { value: 'hsl(270, 70%, 50%)', label: 'Violet' },
  { value: 'hsl(340, 70%, 50%)', label: 'Rose' },
  { value: 'hsl(45, 70%, 50%)', label: 'Jaune' },
  { value: 'hsl(20, 70%, 50%)', label: 'Orange' },
];

export function RevenueStreamDialog({ open, onOpenChange, stream, onSave }: RevenueStreamDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [model, setModel] = useState<'fixed' | 'units' | 'growth'>('fixed');

  useEffect(() => {
    if (stream) {
      setName(stream.name);
      setDescription(stream.description || '');
      setColor(stream.color);
      setModel(stream.model);
    } else {
      setName('');
      setDescription('');
      setColor(COLORS[0].value);
      setModel('fixed');
    }
  }, [stream, open]);

  const handleSave = () => {
    onSave({
      id: stream?.id,
      name,
      description: description || null,
      color,
      model,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{stream ? 'Modifier le flux' : 'Nouveau flux de revenus'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nom du flux</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Abonnements mensuels"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce flux de revenus..."
              rows={3}
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
          <div className="grid gap-2">
            <Label>Modèle de calcul</Label>
            <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Montant fixe mensuel</SelectItem>
                <SelectItem value="units">Unités × Prix unitaire</SelectItem>
                <SelectItem value="subscription">Abonnements SaaS (MRR)</SelectItem>
                <SelectItem value="growth">Croissance progressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {stream ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
