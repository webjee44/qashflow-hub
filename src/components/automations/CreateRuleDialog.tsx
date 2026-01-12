import { useState } from 'react';
import { X, Plus, Zap, PlusCircle, Lightbulb, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Category } from '@/hooks/useAutomationRules';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { cn } from '@/lib/utils';

interface CreateRuleDialogProps {
  categories: Category[];
  onCreateRule: (rule: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    action_type: string;
    target_category_id: string | null;
  }) => Promise<any>;
  onCreateCategory?: (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
  }) => Promise<any>;
  trigger?: React.ReactNode;
}

export function CreateRuleDialog({ categories, onCreateRule, onCreateCategory, trigger }: CreateRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [conditionValue, setConditionValue] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const handleCreateCategory = async (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
  }) => {
    if (onCreateCategory) {
      const result = await onCreateCategory(data);
      if (result?.id) {
        setSelectedCategoryId(result.id);
      }
      return result;
    }
    return null;
  };

  const resetForm = () => {
    setConditionValue('');
    setSelectedCategoryId(null);
    setRuleName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conditionValue.trim() || !selectedCategoryId) return;

    // Auto-generate name if empty
    const finalName = ruleName.trim() || `${conditionValue.toUpperCase()} → ${selectedCategory?.name || 'Catégorie'}`;

    setLoading(true);
    const result = await onCreateRule({
      name: finalName,
      condition_field: 'description',
      condition_operator: 'contains',
      condition_value: conditionValue.trim(),
      action_type: 'categorize',
      target_category_id: selectedCategoryId,
    });
    setLoading(false);

    if (result) {
      setOpen(false);
      resetForm();
    }
  };

  const canSubmit = conditionValue.trim() && selectedCategoryId;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle règle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Créer une règle d'automatisation
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Condition Section */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-xl border border-border/50">
            <Label htmlFor="condition-value" className="text-base font-medium">
              Si la description contient...
            </Label>
            <Input
              id="condition-value"
              placeholder="AMAZON, SNCF, SALAIRE..."
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              className="text-base h-11"
              autoFocus
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              Entrez un mot-clé présent dans vos transactions
            </p>
          </div>

          {/* Category Selection */}
          <div className="space-y-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
            <Label className="text-base font-medium">
              Alors catégoriser dans...
            </Label>
            
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                    "hover:border-primary/50 hover:bg-primary/5",
                    selectedCategoryId === category.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-background"
                  )}
                >
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: category.color }}
                  >
                    {selectedCategoryId === category.id && (
                      <Check className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium truncate">{category.name}</span>
                </button>
              ))}
              
              {/* Create new category button */}
              {onCreateCategory && (
                <button
                  type="button"
                  onClick={() => setShowCategoryDialog(true)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 border-dashed transition-all text-left",
                    "border-primary/30 hover:border-primary hover:bg-primary/5 text-primary"
                  )}
                >
                  <PlusCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">Nouvelle</span>
                </button>
              )}
            </div>

            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Aucune catégorie disponible. Créez-en une !
              </p>
            )}
          </div>

          {/* Optional Rule Name */}
          <div className="space-y-2">
            <Label htmlFor="rule-name" className="text-sm text-muted-foreground">
              Nom de la règle (optionnel)
            </Label>
            <Input
              id="rule-name"
              placeholder={conditionValue && selectedCategory 
                ? `${conditionValue.toUpperCase()} → ${selectedCategory.name}` 
                : "Généré automatiquement"
              }
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Category Dialog */}
          <CategoryDialog
            open={showCategoryDialog}
            onOpenChange={setShowCategoryDialog}
            onSave={handleCreateCategory}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="gradient-primary"
              disabled={loading || !canSubmit}
            >
              {loading ? 'Création...' : 'Créer la règle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
