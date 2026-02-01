import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Tag, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  Check,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

type Transaction = Tables<'transactions'>;

interface BulkCategorizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransactions: Transaction[];
  allTransactions: Transaction[];
  categories: Category[];
  onCategorize: (categoryId: string | null) => Promise<void>;
  onCreateRule?: (rule: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    action_type: string;
    target_category_id: string | null;
  }) => Promise<any>;
  isLoading?: boolean;
}

// Extract common pattern from transactions
function extractCommonPattern(transactions: Transaction[], allTransactions: Transaction[]): string | null {
  if (transactions.length === 0) return null;

  // Count word frequency across ALL transactions to detect company name
  const globalWordFrequency = new Map<string, number>();
  allTransactions.forEach(t => {
    const words = t.description.toUpperCase().split(/\s+/);
    new Set(words).forEach(w => {
      if (w.length > 2) {
        globalWordFrequency.set(w, (globalWordFrequency.get(w) || 0) + 1);
      }
    });
  });
  const globalThreshold = Math.max(2, allTransactions.length * 0.3);

  // Words to exclude
  const excludedWords = /^(CARTE|PAIEMENT|VIR|SEPA|PRLV|CB|PP\d*|FA\d*|F\d+|MCC|EUR|USD|INTERNET|PRELEVEMENT|COMMANDE|POUR|INST|DE|DU|LA|LE|LES|AU|AUX|\d{6,}|[A-Z0-9]{10,})$/i;

  // Extract meaningful words from selected transactions
  const wordCounts = new Map<string, number>();
  transactions.forEach(t => {
    const words = t.description.toUpperCase().split(/\s+/).filter(w => 
      w.length >= 2 &&
      !/^\d+$/.test(w) &&
      !excludedWords.test(w) &&
      (globalWordFrequency.get(w) || 0) < globalThreshold
    );
    
    new Set(words).forEach(w => {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    });
  });

  // Find words that appear in at least 50% of selected transactions
  const threshold = Math.max(1, transactions.length * 0.5);
  const commonWords = Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  if (commonWords.length === 0) return null;

  // Return the most common word(s)
  return commonWords.slice(0, 2).join(' ');
}

export function BulkCategorizeDialog({
  open,
  onOpenChange,
  selectedTransactions,
  allTransactions,
  categories,
  onCategorize,
  onCreateRule,
  isLoading = false,
}: BulkCategorizeDialogProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [createRuleChecked, setCreateRuleChecked] = useState(false);
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  // Analyze selected transactions
  const analysis = useMemo(() => {
    const incomeCount = selectedTransactions.filter(t => t.type === 'income').length;
    const expenseCount = selectedTransactions.filter(t => t.type === 'expense').length;
    const totalAmount = selectedTransactions.reduce((sum, t) => {
      const amount = Number(t.amount);
      return sum + (t.type === 'income' ? amount : -amount);
    }, 0);
    
    const dominantType: 'income' | 'expense' | 'mixed' = 
      incomeCount === 0 ? 'expense' :
      expenseCount === 0 ? 'income' :
      'mixed';

    return { incomeCount, expenseCount, totalAmount, dominantType };
  }, [selectedTransactions]);

  // Detect common pattern for automation suggestion
  const commonPattern = useMemo(() => 
    extractCommonPattern(selectedTransactions, allTransactions),
    [selectedTransactions, allTransactions]
  );

  // Count how many OTHER uncategorized transactions would match this pattern
  const matchingUncategorized = useMemo(() => {
    if (!commonPattern) return 0;
    const selectedIds = new Set(selectedTransactions.map(t => t.id));
    return allTransactions.filter(t => 
      !selectedIds.has(t.id) &&
      !t.category_id &&
      t.description.toUpperCase().includes(commonPattern.toUpperCase())
    ).length;
  }, [commonPattern, selectedTransactions, allTransactions]);

  // Filter categories based on selection type
  const recommendedCategories = useMemo(() => {
    if (analysis.dominantType === 'income') {
      return categories.filter(c => c.type === 'income');
    } else if (analysis.dominantType === 'expense') {
      return categories.filter(c => c.type === 'expense');
    }
    return categories;
  }, [categories, analysis.dominantType]);

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Check for type mismatch
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const hasMismatch = useMemo(() => {
    if (!selectedCategory) return false;
    if (selectedCategory.type === 'income' && analysis.expenseCount > 0) return true;
    if (selectedCategory.type === 'expense' && analysis.incomeCount > 0) return true;
    return false;
  }, [selectedCategory, analysis]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount));
  };

  const handleCategorize = async () => {
    // First, categorize the transactions
    await onCategorize(selectedCategoryId);
    
    // Then, create automation rule if checked
    if (createRuleChecked && commonPattern && selectedCategoryId && onCreateRule) {
      setIsCreatingRule(true);
      try {
        await onCreateRule({
          name: `Auto: ${selectedCategory?.name} - ${commonPattern}`,
          condition_field: 'description',
          condition_operator: 'contains',
          condition_value: commonPattern,
          action_type: 'categorize',
          target_category_id: selectedCategoryId,
        });
      } finally {
        setIsCreatingRule(false);
      }
    }
    
    setSelectedCategoryId(null);
    setCreateRuleChecked(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedCategoryId(null);
    setCreateRuleChecked(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Catégoriser {selectedTransactions.length} transaction{selectedTransactions.length > 1 ? 's' : ''}
              </DialogTitle>
              <DialogDescription>
                Choisissez une catégorie pour les transactions sélectionnées
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Analysis Summary */}
          <div className="px-6 pb-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-4">
                {analysis.incomeCount > 0 && (
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-success" />
                    <span className="text-sm">
                      <span className="font-semibold text-success">{analysis.incomeCount}</span> encaissement{analysis.incomeCount > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {analysis.expenseCount > 0 && (
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                    <span className="text-sm">
                      <span className="font-semibold text-destructive">{analysis.expenseCount}</span> décaissement{analysis.expenseCount > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Smart Recommendation */}
              {analysis.dominantType !== 'mixed' && (
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-muted-foreground">
                    Recommandation : catégories de type{' '}
                    <span className={cn(
                      "font-medium",
                      analysis.dominantType === 'income' ? 'text-success' : 'text-destructive'
                    )}>
                      {analysis.dominantType === 'income' ? 'encaissement' : 'décaissement'}
                    </span>
                  </span>
                </div>
              )}

              {analysis.dominantType === 'mixed' && (
                <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 p-2 rounded">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Attention : vous avez sélectionné des encaissements ET des décaissements. 
                    Choisissez une catégorie adaptée ou séparez votre sélection.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Category Selection */}
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 pb-4">
              {/* Recommended Categories */}
              {analysis.dominantType !== 'mixed' && recommendedCategories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    RECOMMANDÉES
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {recommendedCategories.map(cat => (
                      <Button
                        key={cat.id}
                        variant={selectedCategoryId === cat.id ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "justify-start gap-2 h-auto py-2",
                          selectedCategoryId === cat.id && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedCategoryId(cat.id)}
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                        {selectedCategoryId === cat.id && (
                          <Check className="w-4 h-4 ml-auto shrink-0" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* All Income Categories */}
              {incomeCategories.length > 0 && (analysis.dominantType === 'mixed' || analysis.dominantType === 'expense') && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">ENCAISSEMENTS</p>
                  <div className="grid grid-cols-2 gap-2">
                    {incomeCategories.map(cat => (
                      <Button
                        key={cat.id}
                        variant={selectedCategoryId === cat.id ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "justify-start gap-2 h-auto py-2",
                          selectedCategoryId === cat.id && "ring-2 ring-primary",
                          analysis.expenseCount > 0 && "opacity-60"
                        )}
                        onClick={() => setSelectedCategoryId(cat.id)}
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                        {selectedCategoryId === cat.id && (
                          <Check className="w-4 h-4 ml-auto shrink-0" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* All Expense Categories */}
              {expenseCategories.length > 0 && (analysis.dominantType === 'mixed' || analysis.dominantType === 'income') && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">DÉCAISSEMENTS</p>
                  <div className="grid grid-cols-2 gap-2">
                    {expenseCategories.map(cat => (
                      <Button
                        key={cat.id}
                        variant={selectedCategoryId === cat.id ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "justify-start gap-2 h-auto py-2",
                          selectedCategoryId === cat.id && "ring-2 ring-primary",
                          analysis.incomeCount > 0 && "opacity-60"
                        )}
                        onClick={() => setSelectedCategoryId(cat.id)}
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                        {selectedCategoryId === cat.id && (
                          <Check className="w-4 h-4 ml-auto shrink-0" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Automation Suggestion */}
          {commonPattern && selectedCategoryId && onCreateRule && (
            <div className="mx-6 mb-4">
              <button
                type="button"
                onClick={() => setCreateRuleChecked(!createRuleChecked)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                  createRuleChecked 
                    ? "border-accent bg-accent/10" 
                    : "border-border hover:border-accent/50 hover:bg-accent/5"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  createRuleChecked 
                    ? "border-accent bg-accent text-accent-foreground" 
                    : "border-muted-foreground"
                )}>
                  {createRuleChecked && <Check className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-accent" />
                    <span className="font-medium text-sm">Créer une règle automatique</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pattern détecté : "<span className="font-mono bg-muted px-1 rounded">{commonPattern}</span>"
                    {matchingUncategorized > 0 && (
                      <span className="text-accent font-medium">
                        {' '}→ {matchingUncategorized} autre{matchingUncategorized > 1 ? 's' : ''} transaction{matchingUncategorized > 1 ? 's' : ''} sera{matchingUncategorized > 1 ? 'ont' : ''} catégorisée{matchingUncategorized > 1 ? 's' : ''} automatiquement
                      </span>
                    )}
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Mismatch Warning */}
          {hasMismatch && (
            <div className="mx-6 mb-4 flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>Incohérence détectée :</strong> vous essayez d'assigner une catégorie de type{' '}
                "{selectedCategory?.type === 'income' ? 'encaissement' : 'décaissement'}" à des transactions de type opposé.
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={handleClose}>
                Annuler
              </Button>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    onCategorize(null);
                    onOpenChange(false);
                  }}
                  disabled={isLoading}
                >
                  Retirer la catégorie
                </Button>
                <Button
                  onClick={handleCategorize}
                  disabled={!selectedCategoryId || isLoading || isCreatingRule}
                  className="gap-2"
                >
                  {(isLoading || isCreatingRule) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : createRuleChecked ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Tag className="w-4 h-4" />
                  )}
                  {createRuleChecked ? 'Appliquer + Créer règle' : 'Appliquer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
