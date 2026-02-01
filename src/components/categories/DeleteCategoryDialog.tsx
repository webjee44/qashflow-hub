import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Category } from '@/hooks/useCategories';

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  allCategories: Category[];
  transactionCount: number;
  onConfirm: (reassignToId: string | null) => void;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
  allCategories,
  transactionCount,
  onConfirm,
}: DeleteCategoryDialogProps) {
  const [reassignToId, setReassignToId] = useState<string | null>(null);

  // Filter categories: same type, not the one being deleted
  const availableCategories = useMemo(() => {
    return allCategories.filter(
      (c) => c.type === category.type && c.id !== category.id
    );
  }, [allCategories, category]);

  const handleConfirm = () => {
    onConfirm(reassignToId);
    setReassignToId(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReassignToId(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Supprimer la catégorie ?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Vous êtes sur le point de supprimer la catégorie{' '}
              <strong>"{category.name}"</strong>.
            </p>
            
            {transactionCount > 0 ? (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-800 dark:text-amber-200">
                <p className="font-medium">
                  {transactionCount} transaction{transactionCount > 1 ? 's' : ''} utilise{transactionCount > 1 ? 'nt' : ''} cette catégorie.
                </p>
                <p className="text-sm mt-1">
                  Vous pouvez les reclasser vers une autre catégorie ou les laisser sans catégorie.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Aucune transaction n'utilise cette catégorie.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {transactionCount > 0 && availableCategories.length > 0 && (
          <div className="py-4">
            <Label htmlFor="reassign-category" className="text-sm font-medium">
              Reclasser les transactions vers :
            </Label>
            <Select
              value={reassignToId || 'none'}
              onValueChange={(value) => setReassignToId(value === 'none' ? null : value)}
            >
              <SelectTrigger id="reassign-category" className="mt-2">
                <SelectValue placeholder="Choisir une catégorie..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Ne pas reclasser (laisser sans catégorie)</span>
                </SelectItem>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {reassignToId ? 'Reclasser et supprimer' : 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
