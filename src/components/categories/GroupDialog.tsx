import { useState, useEffect } from 'react';
import { FolderPlus, Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Category } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupDialogProps {
  categories: Category[];
  onSave: (data: {
    name: string;
    color: string;
    type: 'income' | 'expense';
    categoryIds: string[];
  }) => Promise<any>;
  trigger?: React.ReactNode;
  editGroup?: Category | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const colorOptions = [
  { value: 'hsl(142, 76%, 36%)', label: 'Vert' },
  { value: 'hsl(200, 80%, 50%)', label: 'Bleu' },
  { value: 'hsl(173, 80%, 40%)', label: 'Turquoise' },
  { value: 'hsl(0, 84%, 60%)', label: 'Rouge' },
  { value: 'hsl(280, 60%, 50%)', label: 'Violet' },
  { value: 'hsl(38, 92%, 50%)', label: 'Orange' },
  { value: 'hsl(320, 70%, 50%)', label: 'Rose' },
  { value: 'hsl(221, 83%, 53%)', label: 'Indigo' },
  { value: 'hsl(45, 93%, 47%)', label: 'Jaune' },
  { value: 'hsl(160, 60%, 45%)', label: 'Émeraude' },
];

export function GroupDialog({ 
  categories,
  onSave, 
  trigger,
  editGroup,
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
}: GroupDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('hsl(221, 83%, 53%)');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  // Filter categories that can be added to this group
  // - Must be same type
  // - Must not already be a group (have children)
  // - When editing, exclude the group itself
  const availableCategories = categories.filter(c => {
    if (c.type !== type) return false;
    if (editGroup && c.id === editGroup.id) return false;
    // Check if this category is a group (has children)
    const hasChildren = categories.some(child => child.parent_id === c.id);
    if (hasChildren) return false;
    return true;
  });

  // Get categories already in another group (for display purposes)
  const categoriesInOtherGroups = new Set(
    categories
      .filter(c => c.parent_id && (!editGroup || c.parent_id !== editGroup.id))
      .map(c => c.id)
  );

  useEffect(() => {
    if (open) {
      if (editGroup) {
        setName(editGroup.name);
        setColor(editGroup.color);
        setType(editGroup.type);
        // Find categories that belong to this group
        const childIds = categories
          .filter(c => c.parent_id === editGroup.id)
          .map(c => c.id);
        setSelectedIds(new Set(childIds));
      } else {
        setName('');
        setColor('hsl(221, 83%, 53%)');
        setType('expense');
        setSelectedIds(new Set());
      }
    }
  }, [open, editGroup, categories]);

  const toggleCategory = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const result = await onSave({
      name: name.trim(),
      color,
      type,
      categoryIds: Array.from(selectedIds),
    });
    setLoading(false);

    if (result) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-primary" />
            {editGroup ? 'Modifier le groupe' : 'Créer un groupe'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Nom du groupe</Label>
            <Input
              id="group-name"
              placeholder="Ex: Frais généraux"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>

          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  setSelectedIds(new Set());
                }}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                  type === 'expense'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="font-medium">Dépenses</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  setSelectedIds(new Set());
                }}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                  type === 'income'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="font-medium">Revenus</span>
              </button>
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Couleur du groupe
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-10 h-10 rounded-lg transition-all flex items-center justify-center",
                    color === c.value 
                      ? 'ring-2 ring-primary ring-offset-2 scale-110' 
                      : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                >
                  {color === c.value && (
                    <Check className="w-5 h-5 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Catégories à inclure ({selectedIds.size} sélectionnées)</Label>
            <ScrollArea className="h-[200px] rounded-lg border border-border">
              <div className="p-3 space-y-1">
                {availableCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune catégorie disponible pour ce type
                  </p>
                ) : (
                  availableCategories.map((cat) => {
                    const isInOtherGroup = categoriesInOtherGroups.has(cat.id);
                    const isSelected = selectedIds.has(cat.id);
                    
                    return (
                      <div
                        key={cat.id}
                        onClick={() => !isInOtherGroup && toggleCategory(cat.id)}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer",
                          isInOtherGroup 
                            ? "opacity-50 cursor-not-allowed" 
                            : isSelected
                              ? "bg-primary/10"
                              : "hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={isInOtherGroup}
                          onCheckedChange={() => !isInOtherGroup && toggleCategory(cat.id)}
                        />
                        <div
                          className="w-4 h-4 rounded-md flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className={cn(
                          "text-sm font-medium flex-1",
                          isInOtherGroup && "text-muted-foreground"
                        )}>
                          {cat.name}
                        </span>
                        {isInOtherGroup && (
                          <span className="text-xs text-muted-foreground">
                            Dans un autre groupe
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-2">Aperçu</p>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}20` }}
              >
                <FolderPlus 
                  className="w-5 h-5"
                  style={{ color }}
                />
              </div>
              <div>
                <span className="font-medium">{name || 'Nom du groupe'}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{type === 'income' ? 'Revenus' : 'Dépenses'}</span>
                  <span>•</span>
                  <span>{selectedIds.size} catégorie{selectedIds.size > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="gradient-primary"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Enregistrement...' : editGroup ? 'Mettre à jour' : 'Créer le groupe'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}