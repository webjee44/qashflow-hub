import { useState, useEffect, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Loader2, 
  Search, 
  Check,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  PlusCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/logger';
import { Tables } from '@/integrations/supabase/types';
import { Category, CategoryGroup } from '@/hooks/useCategories';

type Transaction = Tables<'transactions'>;

interface CategorizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  incomeCategories: Category[];
  expenseCategories: Category[];
  onSelectCategory: (categoryId: string) => void;
  onRemoveCategory?: () => void;
  onCreateCategory?: () => void;
}

interface AISuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
}

// Group categories by parent for hierarchical display
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

export function CategorizationModal({
  open,
  onOpenChange,
  transaction,
  incomeCategories,
  expenseCategories,
  onSelectCategory,
  onRemoveCategory,
  onCreateCategory,
}: CategorizationModalProps) {
  const [search, setSearch] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Determine which categories to show based on transaction type
  const relevantCategories = transaction?.type === 'income' ? incomeCategories : expenseCategories;
  const categoryGroups = useMemo(() => getGroupedCategories(relevantCategories), [relevantCategories]);

  // Fetch AI suggestion when modal opens
  useEffect(() => {
    if (open && transaction) {
      fetchAISuggestion();
    } else {
      setAiSuggestion(null);
      setAiError(null);
      setSearch('');
    }
  }, [open, transaction?.id]);

  const fetchAISuggestion = async () => {
    if (!transaction) return;
    
    setLoadingAI(true);
    setAiError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAiError('Non connecté');
        return;
      }

      const categoriesForAI = relevantCategories
        .filter(c => c.icon !== 'Folder') // Exclude group headers
        .map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }));

      const { data, error } = await supabase.functions.invoke('suggest-category', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          description: transaction.description,
          type: transaction.type,
          categories: categoriesForAI,
        },
      });

      if (error) {
        logError('AI suggestion error:', error);
        setAiError('Suggestion IA indisponible');
        return;
      }

      if (data?.categoryId) {
        setAiSuggestion({
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          confidence: data.confidence,
        });
      }
    } catch (err) {
      logError('AI suggestion error:', err);
      setAiError('Erreur de suggestion');
    } finally {
      setLoadingAI(false);
    }
  };

  // Filter categories based on search
  const filterGroups = (groups: CategoryGroup[]): CategoryGroup[] => {
    if (!search) return groups;
    const lowerSearch = search.toLowerCase();
    
    return groups.map(group => {
      const filteredChildren = group.children.filter(cat => 
        cat.name.toLowerCase().includes(lowerSearch)
      );
      const groupMatches = group.group?.name.toLowerCase().includes(lowerSearch);
      
      return {
        group: group.group,
        children: groupMatches ? group.children : filteredChildren
      };
    }).filter(group => group.children.length > 0);
  };

  const filteredGroups = useMemo(() => filterGroups(categoryGroups), [categoryGroups, search]);

  const handleSelectCategory = (categoryId: string) => {
    onSelectCategory(categoryId);
    // Don't close here - let the parent handle closing to avoid race conditions with the suggestion dialog
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount));
  };

  const suggestedCategory = aiSuggestion 
    ? relevantCategories.find(c => c.id === aiSuggestion.categoryId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b">
          <DialogTitle className="text-lg">Catégoriser la transaction</DialogTitle>
          <DialogDescription className="sr-only">
            Choisissez une catégorie pour cette transaction
          </DialogDescription>
        </DialogHeader>

        {/* Transaction info */}
        {transaction && (
          <div className="px-4 py-3 bg-muted/50 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {transaction.type === 'income' ? (
                    <ArrowUpRight className="w-4 h-4 text-success shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <span className="font-medium text-sm truncate">
                    {transaction.description}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(transaction.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <span className={cn(
                "font-semibold text-sm shrink-0",
                transaction.type === 'income' ? 'text-success' : 'text-foreground'
              )}>
                {transaction.type === 'income' ? '+' : '-'}{formatAmount(Number(transaction.amount))}
              </span>
            </div>
          </div>
        )}

        {/* AI Suggestion */}
        <div className="px-4 py-3 border-b">
          {loadingAI ? (
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
              <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors">
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
                <Check className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          ) : aiError ? (
            <div className="flex items-center gap-3 py-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-sm">{aiError}</p>
            </div>
          ) : null}
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
        <ScrollArea className="max-h-[40vh]">
          <div className="p-2">
            {/* Remove category (for already-categorized transactions) */}
            {transaction?.category_id && onRemoveCategory && (
              <button
                onClick={() => {
                  onRemoveCategory();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors mb-1"
              >
                <XCircle className="w-4 h-4" />
                Retirer la catégorie
              </button>
            )}

            {/* Create new category */}
            {onCreateCategory && (
              <button
                onClick={() => {
                  onCreateCategory();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-md transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Créer une catégorie
              </button>
            )}

            {/* Grouped categories */}
            {filteredGroups.map((group, idx) => (
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
                      "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors",
                      group.group && "pl-6"
                    )}
                  >
                    {group.group && (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.name}</span>
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
      </DialogContent>
    </Dialog>
  );
}
