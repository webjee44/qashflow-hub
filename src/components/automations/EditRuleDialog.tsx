import { useState, useEffect } from 'react';
import { Zap, Lightbulb, Check, Euro, X, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Category, RuleCondition } from '@/hooks/useAutomationRules';
import { cn } from '@/lib/utils';
import { useBankAccountOptions } from '@/hooks/useBankAccountOptions';

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
    conditions?: RuleCondition[];
  } | null;
  onUpdateRule: (id: string, data: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    target_category_id: string | null;
    conditions?: RuleCondition[];
  }) => Promise<any>;
}

const amountOperators = [
  { value: 'equals', label: 'est égal à' },
  { value: 'greater_than', label: 'est supérieur à' },
  { value: 'less_than', label: 'est inférieur à' },
];

export function EditRuleDialog({ open, onOpenChange, categories, rule, onUpdateRule }: EditRuleDialogProps) {
  const bankAccounts = useBankAccountOptions();
  const [loading, setLoading] = useState(false);
  const [conditionValue, setConditionValue] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  
  // Amount condition
  const [showAmountCondition, setShowAmountCondition] = useState(false);
  const [amountOperator, setAmountOperator] = useState('equals');
  const [amountValue, setAmountValue] = useState('');

  // Bank account condition
  const [showBankCondition, setShowBankCondition] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState('');

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      setRuleName(rule.name);
      setSelectedCategoryId(rule.target_category_id);
      
      const conditions = rule.conditions || [];
      
      const descCondition = conditions.find(c => c.condition_field === 'description');
      setConditionValue(descCondition?.condition_value || rule.condition_value || '');
      
      const amountCondition = conditions.find(c => c.condition_field === 'amount');
      if (amountCondition) {
        setShowAmountCondition(true);
        setAmountOperator(amountCondition.condition_operator || 'equals');
        setAmountValue(amountCondition.condition_value || '');
      } else {
        setShowAmountCondition(false);
        setAmountOperator('equals');
        setAmountValue('');
      }

      const bankCondition = conditions.find(c => c.condition_field === 'bank_account_name');
      if (bankCondition) {
        setShowBankCondition(true);
        setSelectedBankAccount(bankCondition.condition_value || '');
      } else {
        setShowBankCondition(false);
        setSelectedBankAccount('');
      }
    }
  }, [rule]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rule || !conditionValue.trim() || !selectedCategoryId) return;

    // Build conditions array
    const conditions: RuleCondition[] = [
      {
        condition_field: 'description',
        condition_operator: 'contains',
        condition_value: conditionValue.trim(),
      }
    ];

    // Add amount condition if enabled
    if (showAmountCondition && amountValue.trim()) {
      conditions.push({
        condition_field: 'amount',
        condition_operator: amountOperator,
        condition_value: amountValue.trim().replace(',', '.'),
      });
    }

    // Add bank account condition if enabled
    if (showBankCondition && selectedBankAccount) {
      conditions.push({
        condition_field: 'bank_account_name',
        condition_operator: 'equals',
        condition_value: selectedBankAccount,
      });
    }

    // Auto-generate name if empty
    let finalName = ruleName.trim();
    if (!finalName) {
      finalName = `${conditionValue.toUpperCase()}`;
      if (showAmountCondition && amountValue.trim()) {
        finalName += ` + ${amountValue} €`;
      }
      finalName += ` → ${selectedCategory?.name || 'Catégorie'}`;
    }

    setLoading(true);
    const result = await onUpdateRule(rule.id, {
      name: finalName,
      condition_field: 'description',
      condition_operator: 'contains',
      condition_value: conditionValue.trim(),
      target_category_id: selectedCategoryId,
      conditions,
    });
    setLoading(false);

    if (result) {
      onOpenChange(false);
    }
  };

  const canSubmit = conditionValue.trim() && selectedCategoryId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Modifier la règle
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Description Condition */}
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

          {/* Amount Condition (optional) */}
          {showAmountCondition ? (
            <div className="space-y-3 p-4 bg-accent/5 rounded-xl border border-accent/20">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Euro className="w-4 h-4 text-accent" />
                  ET le montant...
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAmountCondition(false);
                    setAmountValue('');
                  }}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex gap-2 items-center">
                <Select value={amountOperator} onValueChange={setAmountOperator}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {amountOperators.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="9622.80"
                    value={amountValue}
                    onChange={(e) => setAmountValue(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tolérance de 0.01 € pour les arrondis bancaires
              </p>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAmountCondition(true)}
              className="w-full border-dashed border-accent/30 text-accent hover:bg-accent/5 hover:border-accent"
            >
              <Euro className="w-4 h-4 mr-2" />
              + Ajouter un critère de montant
            </Button>
          )}

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
                ? `${conditionValue.toUpperCase()}${showAmountCondition && amountValue ? ` + ${amountValue} €` : ''} → ${selectedCategory.name}` 
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
