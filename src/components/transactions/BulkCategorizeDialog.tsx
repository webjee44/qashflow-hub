import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  AlertTriangle, 
  Tag, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  Check,
  Sparkles,
  Zap,
  ChevronDown,
  Search,
  Pencil,
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
  const [otherCategoryOpen, setOtherCategoryOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState(false);
  const [customPattern, setCustomPattern] = useState<string>('');

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
  const detectedPattern = useMemo(() => 
    extractCommonPattern(selectedTransactions, allTransactions),
    [selectedTransactions, allTransactions]
  );

  // Use custom pattern if set, otherwise use detected
  const activePattern = customPattern || detectedPattern;

  // Initialize custom pattern when dialog opens
  useMemo(() => {
    if (open && detectedPattern && !customPattern) {
      setCustomPattern(detectedPattern);
    }
  }, [open, detectedPattern]);

  // Count how many OTHER uncategorized transactions would match this pattern
  const matchingUncategorized = useMemo(() => {
    if (!activePattern) return 0;
    const selectedIds = new Set(selectedTransactions.map(t => t.id));
    return allTransactions.filter(t => 
      !selectedIds.has(t.id) &&
      !t.category_id &&
      t.description.toUpperCase().includes(activePattern.toUpperCase())
    ).length;
  }, [activePattern, selectedTransactions, allTransactions]);

  // Filter categories based on selection type - these are the recommended ones
  const recommendedCategories = useMemo(() => {
    if (analysis.dominantType === 'income') {
      return categories.filter(c => c.type === 'income');
    } else if (analysis.dominantType === 'expense') {
      return categories.filter(c => c.type === 'expense');
    }
    return categories;
  }, [categories, analysis.dominantType]);

  // Other categories (not recommended)
  const otherCategories = useMemo(() => {
    const recommendedIds = new Set(recommendedCategories.map(c => c.id));
    return categories.filter(c => !recommendedIds.has(c.id));
  }, [categories, recommendedCategories]);

  // Check for type mismatch
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const hasMismatch = useMemo(() => {
    if (!selectedCategory) return false;
    if (selectedCategory.type === 'income' && analysis.expenseCount > 0) return true;
    if (selectedCategory.type === 'expense' && analysis.incomeCount > 0) return true;
    return false;
  }, [selectedCategory, analysis]);

  const handleCategorize = async () => {
    // First, categorize the transactions
    await onCategorize(selectedCategoryId);
    
    // Then, create automation rule if checked
    if (createRuleChecked && activePattern && selectedCategoryId && onCreateRule) {
      setIsCreatingRule(true);
      try {
        await onCreateRule({
          name: `Auto: ${selectedCategory?.name} - ${activePattern}`,
          condition_field: 'description',
          condition_operator: 'contains',
          condition_value: activePattern,
          action_type: 'categorize',
          target_category_id: selectedCategoryId,
        });
      } finally {
        setIsCreatingRule(false);
      }
    }
    
    setSelectedCategoryId(null);
    setCreateRuleChecked(false);
    setCustomPattern('');
    setEditingPattern(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedCategoryId(null);
    setCreateRuleChecked(false);
    setCustomPattern('');
    setEditingPattern(false);
    onOpenChange(false);
  };

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setOtherCategoryOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0">
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

          {/* Analysis Summary - Compact */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-4 text-sm">
              {analysis.incomeCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-success" />
                  <span className="font-semibold text-success">{analysis.incomeCount}</span>
                  <span className="text-muted-foreground">encaissement{analysis.incomeCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {analysis.expenseCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <ArrowDownRight className="w-4 h-4 text-destructive" />
                  <span className="font-semibold text-destructive">{analysis.expenseCount}</span>
                  <span className="text-muted-foreground">décaissement{analysis.expenseCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {analysis.dominantType === 'mixed' && (
              <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 p-2 rounded mt-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Sélection mixte : vérifiez la compatibilité de la catégorie.</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-6 pb-4 space-y-4">
            {/* Recommended Categories */}
            {recommendedCategories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" />
                  RECOMMANDÉES
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {recommendedCategories.slice(0, 6).map(cat => (
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
                      <span className="truncate text-left flex-1">{cat.name}</span>
                      {selectedCategoryId === cat.id && (
                        <Check className="w-4 h-4 shrink-0" />
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Other Categories - Dropdown with Search */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                AUTRE CATÉGORIE
              </p>
              <Popover open={otherCategoryOpen} onOpenChange={setOtherCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={otherCategoryOpen}
                    className="w-full justify-between"
                  >
                    {selectedCategoryId && !recommendedCategories.find(c => c.id === selectedCategoryId) ? (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: selectedCategory?.color }}
                        />
                        <span>{selectedCategory?.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Rechercher une catégorie...
                      </span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[10000]" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher..." />
                    <CommandList>
                      <CommandEmpty>Aucune catégorie trouvée.</CommandEmpty>
                      {recommendedCategories.length > 6 && (
                        <CommandGroup heading="Recommandées">
                          {recommendedCategories.slice(6).map(cat => (
                            <CommandItem
                              key={cat.id}
                              value={`${cat.name}-${cat.id}`}
                              onSelect={() => {
                                setSelectedCategoryId(cat.id);
                                setOtherCategoryOpen(false);
                              }}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <div 
                                className="w-3 h-3 rounded-full shrink-0" 
                                style={{ backgroundColor: cat.color }}
                              />
                              <span>{cat.name}</span>
                              {selectedCategoryId === cat.id && (
                                <Check className="w-4 h-4 ml-auto" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {otherCategories.length > 0 && (
                        <CommandGroup heading={analysis.dominantType === 'income' ? 'Décaissements' : 'Encaissements'}>
                          {otherCategories.map(cat => (
                            <CommandItem
                              key={cat.id}
                              value={`${cat.name}-${cat.id}`}
                              onSelect={() => {
                                setSelectedCategoryId(cat.id);
                                setOtherCategoryOpen(false);
                              }}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <div 
                                className="w-3 h-3 rounded-full shrink-0" 
                                style={{ backgroundColor: cat.color }}
                              />
                              <span>{cat.name}</span>
                              {selectedCategoryId === cat.id && (
                                <Check className="w-4 h-4 ml-auto" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Mismatch Warning */}
            {hasMismatch && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>Incohérence :</strong> catégorie de type{' '}
                  "{selectedCategory?.type === 'income' ? 'encaissement' : 'décaissement'}" 
                  appliquée à des transactions opposées.
                </span>
              </div>
            )}

            {/* Automation Rule - More Prominent */}
            {detectedPattern && selectedCategoryId && onCreateRule && (
              <div className={cn(
                "rounded-lg border-2 p-4 transition-all",
                createRuleChecked 
                  ? "border-accent bg-accent/10" 
                  : "border-dashed border-muted-foreground/30 hover:border-accent/50"
              )}>
                <button
                  type="button"
                  onClick={() => setCreateRuleChecked(!createRuleChecked)}
                  className="w-full flex items-start gap-3 text-left"
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                    createRuleChecked 
                      ? "border-accent bg-accent text-accent-foreground" 
                      : "border-muted-foreground/50"
                  )}>
                    {createRuleChecked && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-accent" />
                      <span className="font-semibold text-sm">Créer une règle automatique</span>
                      {matchingUncategorized > 0 && (
                        <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                          +{matchingUncategorized} à catégoriser
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Les futures transactions contenant ce pattern seront catégorisées automatiquement
                    </p>
                  </div>
                </button>

                {/* Pattern Editor */}
                {createRuleChecked && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Pattern :</span>
                      {editingPattern ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={customPattern}
                            onChange={(e) => setCustomPattern(e.target.value.toUpperCase())}
                            className="h-7 text-xs font-mono flex-1"
                            placeholder="Ex: AMAZON"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingPattern(false)}
                          >
                            <Check className="w-4 h-4 text-success" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {activePattern}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setCustomPattern(activePattern || '');
                              setEditingPattern(true);
                            }}
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={handleClose}>
                Annuler
              </Button>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onCategorize(null);
                    onOpenChange(false);
                  }}
                  disabled={isLoading}
                >
                  Retirer
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
                  {createRuleChecked ? 'Appliquer + Règle' : 'Appliquer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
