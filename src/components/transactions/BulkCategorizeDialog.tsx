import { useMemo, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Check,
  Sparkles,
  Zap,
  Search,
  Pencil,
  ChevronRight,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Category, CategoryGroup } from '@/hooks/useCategories';
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

  const excludedWords = /^(CARTE|PAIEMENT|VIR|SEPA|PRLV|CB|PP\d*|FA\d*|F\d+|MCC|EUR|USD|INTERNET|PRELEVEMENT|COMMANDE|POUR|INST|DE|DU|LA|LE|LES|AU|AUX|\d{6,}|[A-Z0-9]{10,})$/i;

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

  const threshold = Math.max(1, transactions.length * 0.5);
  const commonWords = Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  if (commonWords.length === 0) return null;
  return commonWords.slice(0, 2).join(' ');
}

// Group categories by parent for hierarchical display (same as CategorizationModal)
function getGroupedCategories(categories: Category[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  const childrenByParent = new Map<string, Category[]>();
  const topLevelCats: Category[] = [];

  categories.forEach(cat => {
    if (cat.parent_id) {
      const existing = childrenByParent.get(cat.parent_id) || [];
      existing.push(cat);
      childrenByParent.set(cat.parent_id, existing);
    }
  });

  categories.forEach(cat => {
    if (!cat.parent_id) {
      const hasChildren = childrenByParent.has(cat.id);
      const isGroupByIcon = cat.icon === 'Folder';

      if (hasChildren || isGroupByIcon) {
        const children = childrenByParent.get(cat.id) || [];
        children.sort((a, b) => {
          const orderA = a.sort_order ?? 0;
          const orderB = b.sort_order ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });
        groups.push({ group: cat, children });
      } else {
        topLevelCats.push(cat);
      }
    }
  });

  topLevelCats.sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  if (topLevelCats.length > 0) {
    groups.unshift({ group: null, children: topLevelCats });
  }

  return groups.sort((a, b) => {
    if (!a.group) return -1;
    if (!b.group) return 1;
    const orderA = a.group.sort_order ?? 0;
    const orderB = b.group.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.group.name.localeCompare(b.group.name);
  });
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
  const [editingPattern, setEditingPattern] = useState(false);
  const [customPattern, setCustomPattern] = useState<string>('');
  const [search, setSearch] = useState('');

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<{
    categoryId: string;
    categoryName: string;
    confidence: number;
  } | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Analyze selected transactions
  const analysis = useMemo(() => {
    const incomeCount = selectedTransactions.filter(t => t.type === 'income').length;
    const expenseCount = selectedTransactions.filter(t => t.type === 'expense').length;
    const dominantType: 'income' | 'expense' | 'mixed' =
      incomeCount === 0 ? 'expense' :
      expenseCount === 0 ? 'income' :
      'mixed';
    return { incomeCount, expenseCount, dominantType };
  }, [selectedTransactions]);

  // Get relevant categories based on dominant type
  const relevantCategories = useMemo(() => {
    if (analysis.dominantType === 'income') return categories.filter(c => c.type === 'income');
    if (analysis.dominantType === 'expense') return categories.filter(c => c.type === 'expense');
    return categories;
  }, [categories, analysis.dominantType]);

  const categoryGroups = useMemo(() => getGroupedCategories(relevantCategories), [relevantCategories]);

  // Detect common pattern for automation suggestion
  const detectedPattern = useMemo(() =>
    extractCommonPattern(selectedTransactions, allTransactions),
    [selectedTransactions, allTransactions]
  );

  const activePattern = customPattern || detectedPattern;

  useMemo(() => {
    if (open && detectedPattern && !customPattern) {
      setCustomPattern(detectedPattern);
    }
  }, [open, detectedPattern]);

  // Fetch AI suggestion when dialog opens
  useEffect(() => {
    if (!open || selectedTransactions.length === 0 || categories.length === 0) {
      setAiSuggestion(null);
      return;
    }

    const fetchSuggestion = async () => {
      setIsLoadingAI(true);
      setAiSuggestion(null);
      try {
        const tx = selectedTransactions[0];
        const categoriesForAI = relevantCategories
          .filter(c => c.icon !== 'Folder')
          .map(c => ({ id: c.id, name: c.name, type: c.type }));

        if (categoriesForAI.length === 0) {
          setIsLoadingAI(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('suggest-category', {
          body: {
            description: tx.description,
            type: tx.type,
            categories: categoriesForAI,
          },
        });

        if (error) {
          logError('AI suggestion error:', error);
          return;
        }

        if (data?.categoryId) {
          setAiSuggestion({
            categoryId: data.categoryId,
            categoryName: data.categoryName,
            confidence: data.confidence,
          });
        }
      } catch (e) {
        logError('AI suggestion error:', e);
      } finally {
        setIsLoadingAI(false);
      }
    };

    fetchSuggestion();
  }, [open, selectedTransactions, categories]);

  // Count matching uncategorized transactions
  const matchingUncategorized = useMemo(() => {
    if (!activePattern) return 0;
    const selectedIds = new Set(selectedTransactions.map(t => t.id));
    return allTransactions.filter(t =>
      !selectedIds.has(t.id) &&
      !t.category_id &&
      t.description.toUpperCase().includes(activePattern.toUpperCase())
    ).length;
  }, [activePattern, selectedTransactions, allTransactions]);

  // Filter categories based on search
  const filteredGroups = useMemo(() => {
    if (!search) return categoryGroups;
    const lowerSearch = search.toLowerCase();

    return categoryGroups.map(group => {
      const filteredChildren = group.children.filter(cat =>
        cat.name.toLowerCase().includes(lowerSearch)
      );
      const groupMatches = group.group?.name.toLowerCase().includes(lowerSearch);

      return {
        group: group.group,
        children: groupMatches ? group.children : filteredChildren,
      };
    }).filter(group => group.children.length > 0);
  }, [categoryGroups, search]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const suggestedCategory = aiSuggestion
    ? relevantCategories.find(c => c.id === aiSuggestion.categoryId)
    : null;

  // Check for type mismatch
  const hasMismatch = useMemo(() => {
    if (!selectedCategory) return false;
    if (selectedCategory.type === 'income' && analysis.expenseCount > 0) return true;
    if (selectedCategory.type === 'expense' && analysis.incomeCount > 0) return true;
    return false;
  }, [selectedCategory, analysis]);

  const handleCategorize = async () => {
    await onCategorize(selectedCategoryId);

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
    setSearch('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedCategoryId(null);
    setCreateRuleChecked(false);
    setCustomPattern('');
    setEditingPattern(false);
    setSearch('');
    onOpenChange(false);
  };

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b">
          <DialogTitle className="text-lg">
            Catégoriser {selectedTransactions.length} transaction{selectedTransactions.length > 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choisissez une catégorie pour les transactions sélectionnées
          </DialogDescription>
        </DialogHeader>

        {/* Transaction summary */}
        <div className="px-4 py-3 bg-muted/50 border-b">
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
            <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 p-2 rounded mt-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Sélection mixte : vérifiez la compatibilité de la catégorie.</span>
            </div>
          )}
        </div>

        {/* AI Suggestion */}
        <div className="px-4 py-3 border-b">
          {isLoadingAI ? (
            <div className="flex items-center gap-3 py-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-accent" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium">Analyse IA en cours...</p>
                <p className="text-xs text-muted-foreground">Suggestion optimale</p>
              </div>
            </div>
          ) : aiSuggestion && suggestedCategory ? (
            <button
              onClick={() => handleSelectCategory(aiSuggestion.categoryId)}
              className="w-full text-left group"
            >
              <div className={cn(
                "flex items-center gap-3 p-2 -mx-2 rounded-lg transition-colors",
                selectedCategoryId === aiSuggestion.categoryId
                  ? "bg-accent/15 ring-2 ring-accent"
                  : "hover:bg-accent/10"
              )}>
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Suggestion IA</span>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(aiSuggestion.confidence * 100)}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: suggestedCategory.color }}
                    />
                    <span className="text-sm text-muted-foreground truncate">
                      {suggestedCategory.name}
                    </span>
                  </div>
                </div>
                {selectedCategoryId === aiSuggestion.categoryId ? (
                  <Check className="w-5 h-5 text-accent shrink-0" />
                ) : (
                  <Check className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 py-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-sm">Suggestion IA indisponible</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une catégorie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Category List */}
        <ScrollArea className="max-h-[30vh]">
          <div className="p-2">
            {filteredGroups.map((group) => (
              <div key={group.group?.id || 'ungrouped'}>
                {group.group && (
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2 mt-2">
                    {group.group.name}
                  </div>
                )}
                {group.children.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      group.group && "pl-6",
                      selectedCategoryId === cat.id
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {group.group && (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate flex-1 text-left">{cat.name}</span>
                    {selectedCategoryId === cat.id && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))}

            {filteredGroups.length === 0 && search && (
              <p className="text-center text-sm text-muted-foreground py-6">
                Aucune catégorie "{search}"
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Mismatch Warning */}
        {hasMismatch && (
          <div className="px-4 py-2">
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>Incohérence :</strong> catégorie de type{' '}
                "{selectedCategory?.type === 'income' ? 'encaissement' : 'décaissement'}"
                appliquée à des transactions opposées.
              </span>
            </div>
          </div>
        )}

        {/* Automation Rule */}
        {detectedPattern && selectedCategoryId && onCreateRule && (
          <div className="px-4 py-3 border-t">
            <div className={cn(
              "rounded-lg border-2 p-3 transition-all",
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <Zap className="w-4 h-4 text-accent" />
                    <span className="font-semibold text-sm">Créer une règle automatique</span>
                    {matchingUncategorized > 0 && (
                      <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                        +{matchingUncategorized}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Catégorisation automatique des futures transactions similaires
                  </p>
                </div>
              </button>

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
                          size="sm"
                          className="h-7 px-3 text-xs gap-1"
                          onClick={() => setEditingPattern(false)}
                        >
                          <Check className="w-3.5 h-3.5" />
                          OK
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
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Annuler
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
                <Check className="w-4 h-4" />
              )}
              {createRuleChecked ? 'Appliquer + Règle' : 'Appliquer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
