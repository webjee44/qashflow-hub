import { useState, useEffect } from 'react';
import { Zap, Lightbulb, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Category } from '@/hooks/useAutomationRules';
import { cn } from '@/lib/utils';

interface EditRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  rule: {
    id: string;
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    target_category_id: string | null;
  } | null;
  onUpdateRule: (id: string, data: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    target_category_id: string | null;
  }) => Promise<any>;
}

export function EditRuleDialog({ open, onOpenChange, categories, rule, onUpdateRule }: EditRuleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [conditionValue, setConditionValue] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      setConditionValue(rule.condition_value);
      setSelectedCategoryId(rule.target_category_id);
      setRuleName(rule.name);
    }
  }, [rule]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rule || !conditionValue.trim() || !selectedCategoryId) return;

    const finalName = ruleName.trim() || `${conditionValue.toUpperCase()} → ${selectedCategory?.name || 'Catégorie'}`;

    setLoading(true);
    const result = await onUpdateRule(rule.id, {
      name: finalName,
      condition_field: 'description',
      condition_operator: 'contains',
      condition_value: conditionValue.trim(),
      target_category_id: selectedCategoryId,
    });
    setLoading(false);

    if (result) {
      onOpenChange(false);
    }
  };

  const canSubmit = conditionValue.trim() && selectedCategoryId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Modifier la règle
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Condition Section */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-xl border border-border/50">
            <Label htmlFor="edit-condition-value" className="text-base font-medium">
              Si la description contient...
            </Label>
            <Input
              id="edit-condition-value"
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
            
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
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
            </div>
          </div>

          {/* Rule Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-rule-name" className="text-sm text-muted-foreground">
              Nom de la règle
            </Label>
            <Input
              id="edit-rule-name"
              placeholder={conditionValue && selectedCategory 
                ? `${conditionValue.toUpperCase()} → ${selectedCategory.name}` 
                : "Généré automatiquement"
              }
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="gradient-primary"
              disabled={loading || !canSubmit}
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
