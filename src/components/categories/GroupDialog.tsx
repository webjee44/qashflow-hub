import { useState } from 'react';
import { FolderPlus, Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';

// Predefined colors
const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#78716c', '#64748b', '#6b7280',
];

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  vat_rate: number;
  parent_id?: string | null;
}

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  editGroup?: Category | null;
  categories: Category[];
  defaultType?: 'income' | 'expense';
  onSave: (data: {
    name: string;
    color: string;
    type: 'income' | 'expense';
    categoryIds: string[];
  }) => void;
}

export function GroupDialog({
  open,
  onOpenChange,
  mode,
  editGroup,
  categories,
  defaultType = 'expense',
  onSave,
}: GroupDialogProps) {
  // Initialize state based on mode - this runs once per mount (keyed remount strategy)
  const [name, setName] = useState(() => 
    mode === 'edit' && editGroup ? editGroup.name : ''
  );
  const [color, setColor] = useState(() => 
    mode === 'edit' && editGroup ? editGroup.color : COLORS[Math.floor(Math.random() * COLORS.length)]
  );
  const [type, setType] = useState<'income' | 'expense'>(() => 
    mode === 'edit' && editGroup ? editGroup.type : defaultType
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (mode === 'edit' && editGroup) {
      return categories
        .filter(c => c.parent_id === editGroup.id)
        .map(c => c.id);
    }
    return [];
  });

  // Filter categories that can be added to this group
  const availableCategories = categories.filter(cat => {
    // Must match the group type
    if (cat.type !== type) return false;
    // Must not be a group itself (has children)
    const hasChildren = categories.some(c => c.parent_id === cat.id);
    if (hasChildren) return false;
    // Must not already belong to another group (except this one if editing)
    if (cat.parent_id !== null && cat.parent_id !== editGroup?.id) return false;
    // Exclude the group itself
    if (cat.id === editGroup?.id) return false;
    return true;
  });

  const toggleCategory = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    // Reset selection when type changes
    setSelectedIds([]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      color,
      type,
      categoryIds: selectedIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            {mode === 'edit' ? 'Modifier le groupe' : 'Créer un groupe'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' 
              ? 'Modifiez les informations du groupe et ses catégories.'
              : 'Donnez un nom au groupe et sélectionnez les catégories à regrouper.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Nom du groupe</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Frais de bureau"
            />
          </div>

          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Dépense</SelectItem>
                <SelectItem value="income">Revenu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>Couleur</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                >
                  <div
                    className="h-4 w-4 rounded-full border"
                    style={{ backgroundColor: color }}
                  />
                  <Palette className="h-4 w-4" />
                  Choisir une couleur
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="grid grid-cols-5 gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{
                        backgroundColor: c,
                        borderColor: color === c ? 'white' : 'transparent',
                        boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                      }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label>
              Catégories à inclure ({selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''})
            </Label>
            <ScrollArea className="h-[200px] rounded-md border p-2">
              {availableCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">
                  Aucune catégorie {type === 'income' ? 'de revenu' : 'de dépense'} disponible.
                </p>
              ) : (
                <div className="space-y-1">
                  {availableCategories.map((cat) => {
                    const isSelected = selectedIds.includes(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCategory(cat.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm">{cat.name}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 ml-auto text-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {mode === 'edit' ? 'Enregistrer' : 'Créer le groupe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
