import { useState, useMemo } from 'react';
import { Plus, Zap, PlusCircle, Lightbulb, Check, Euro, X, Search, Landmark } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Category, RuleCondition } from '@/hooks/useAutomationRules';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { cn } from '@/lib/utils';
import { useBankAccountOptions } from '@/hooks/useBankAccountOptions';

interface CreateRuleDialogProps {
  categories: Category[];
  onCreateRule: (rule: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    action_type: string;
    target_category_id: string | null;
    conditions?: RuleCondition[];
  }) => Promise<any>;
  onCreateCategory?: (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
  }) => Promise<any>;
  trigger?: React.ReactNode;
  defaultAmount?: number;
}

interface ConditionInput {
  field: 'description' | 'amount' | 'bank_account_name';
  operator: string;
  value: string;
}

const amountOperators = [
  { value: 'equals', label: 'est égal à' },
  { value: 'greater_than', label: 'est supérieur à' },
  { value: 'less_than', label: 'est inférieur à' },
];

export function CreateRuleDialog({ categories, onCreateRule, onCreateCategory, trigger, defaultAmount }: CreateRuleDialogProps) {
  const bankAccounts = useBankAccountOptions();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  
  // Main condition (description)
  const [conditionValue, setConditionValue] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  
  // Additional amount condition
  const [showAmountCondition, setShowAmountCondition] = useState(!!defaultAmount);
  const [amountOperator, setAmountOperator] = useState('equals');
  const [amountValue, setAmountValue] = useState(defaultAmount?.toString() || '');

  // Bank account condition
  const [showBankCondition, setShowBankCondition] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState('');

  // Category search
  const [categorySearch, setCategorySearch] = useState('');

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const search = categorySearch.toLowerCase().trim();
    return categories.filter(c => c.name.toLowerCase().includes(search));
  }, [categories, categorySearch]);

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
    setShowAmountCondition(!!defaultAmount);
    setAmountOperator('equals');
    setAmountValue(defaultAmount?.toString() || '');
    setCategorySearch('');
    setShowBankCondition(false);
    setSelectedBankAccount('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conditionValue.trim() || !selectedCategoryId) return;

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
    const result = await onCreateRule({
      name: finalName,
      condition_field: 'description',
      condition_operator: 'contains',
      condition_value: conditionValue.trim(),
      action_type: 'categorize',
      target_category_id: selectedCategoryId,
      conditions,
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
      <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Créer une règle d'automatisation
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Description Condition */}
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

          {/* Bank Account Condition (optional) */}
          {showBankCondition ? (
            <div className="space-y-3 p-4 bg-accent/5 rounded-xl border border-accent/20">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-accent" />
                  ET le compte bancaire...
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowBankCondition(false);
                    setSelectedBankAccount('');
                  }}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un compte" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.name} value={acc.name}>
                      {acc.display}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : bankAccounts.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBankCondition(true)}
              className="w-full border-dashed border-accent/30 text-accent hover:bg-accent/5 hover:border-accent"
            >
              <Landmark className="w-4 h-4 mr-2" />
              + Ajouter un critère de compte bancaire
            </Button>
          ) : null}

          {/* Category Selection */}
          <div className="space-y-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
            <Label className="text-base font-medium">
              Alors catégoriser dans...
            </Label>
            
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une catégorie..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto">
              {filteredCategories.map((category) => (
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

            {filteredCategories.length === 0 && categorySearch && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Aucune catégorie ne correspond à "{categorySearch}"
              </p>
            )}

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
                ? `${conditionValue.toUpperCase()}${showAmountCondition && amountValue ? ` + ${amountValue} €` : ''} → ${selectedCategory.name}` 
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
