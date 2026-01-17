import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera } from 'lucide-react';

interface SnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; description?: string }) => void;
}

export function SnapshotDialog({ open, onOpenChange, onSave }: SnapshotDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    onSave({ name, description: description || undefined });
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Créer un snapshot
          </DialogTitle>
          <DialogDescription>
            Sauvegardez l'état actuel de votre business plan pour pouvoir le comparer plus tard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nom du snapshot</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Version avant levée de fonds"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez les hypothèses de cette version..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Créer le snapshot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
