import { useState, useEffect, useMemo } from 'react';
import { SYSTEM_CATEGORY_INTERCOMPTE } from '@/features/categories/hooks/useCategories';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ArrowLeft,
  PlusCircle,
  XCircle,
  Lock,
  TrendingUp,
  TrendingDown,
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
  onInlineCreateCategory?: (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    vat_rate: number;
  }) => Promise<any>;
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
  onInlineCreateCategory,
}: CategorizationModalProps) {
  const [search, setSearch] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    color: 'hsl(221, 83%, 53%)',
    type: 'expense' as 'income' | 'expense',
    vat_rate: 0.20,
  });

  // Determine which categories to show based on transaction type
  // System category "Virement intercompte" is shown for both types
  const relevantCategories = useMemo(() => {
    const baseCategories = transaction?.type === 'income' ? incomeCategories : expenseCategories;
    const allCategories = [...incomeCategories, ...expenseCategories];
    const systemCats = allCategories.filter(c => c.name === SYSTEM_CATEGORY_INTERCOMPTE && !baseCategories.some(b => b.id === c.id));
    return [...baseCategories, ...systemCats];
  }, [transaction?.type, incomeCategories, expenseCategories]);
  const categoryGroups = useMemo(() => getGroupedCategories(relevantCategories), [relevantCategories]);

  // Fetch AI suggestion when modal opens
  useEffect(() => {
    if (open && transaction) {
      fetchAISuggestion();
    } else {
      setAiSuggestion(null);
      setAiError(null);
      setSearch('');
      setShowCreateForm(false);
      setNewCategoryForm({
        name: '',
        color: 'hsl(221, 83%, 53%)',
        type: 'expense',
        vat_rate: 0.20,
      });
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

  const colorOptions = [
    { value: 'hsl(142, 76%, 36%)', label: 'Vert' },
    { value: 'hsl(200, 80%, 50%)', label: 'Bleu' },
    { value: 'hsl(173, 80%, 40%)', label: 'Turquoise' },
    { value: 'hsl(0, 84%, 60%)', label: 'Rouge' },
    { value: 'hsl(280, 60%, 50%)', label: 'Violet' },
    { value: 'hsl(38, 92%, 50%)', label: 'Orange' },
    { value: 'hsl(320, 70%, 50%)', label: 'Rose' },
    { value: 'hsl(221, 83%, 53%)', label: 'Indigo' },
  ];

  const vatOptions = [
    { value: 0, label: '0%' },
    { value: 0.055, label: '5.5%' },
    { value: 0.10, label: '10%' },
    { value: 0.20, label: '20%' },
  ];

  const handleInlineCreate = async () => {
    if (!newCategoryForm.name.trim() || !onInlineCreateCategory) return;
    setCreatingCategory(true);
    const result = await onInlineCreateCategory({
      name: newCategoryForm.name.trim(),
      color: newCategoryForm.color,
      icon: 'Tag',
      type: newCategoryForm.type,
      vat_rate: newCategoryForm.vat_rate,
    });
    setCreatingCategory(false);
    if (result) {
      setShowCreateForm(false);
      setNewCategoryForm({ name: '', color: 'hsl(221, 83%, 53%)', type: 'expense', vat_rate: 0.20 });
      if (result.id) {
        handleSelectCategory(result.id);
      }
    }
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
      <DialogContent className="!max-w-[min(64rem,calc(100vw-2rem))] w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="min-w-0 p-4 pb-3 border-b">
          <DialogTitle className="text-lg flex min-w-0 items-center gap-2 pr-8">
            {showCreateForm && (
              <button onClick={() => setShowCreateForm(false)} className="hover:bg-muted rounded-md p-1 -ml-1 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="min-w-0 truncate">
              {showCreateForm ? 'Nouvelle catégorie' : 'Catégoriser la transaction'}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {showCreateForm ? 'Créez une nouvelle catégorie' : 'Choisissez une catégorie pour cette transaction'}
          </DialogDescription>
        </DialogHeader>

        {showCreateForm ? (
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inline-cat-name">Nom</Label>
              <Input
                id="inline-cat-name"
                placeholder="Ex: Abonnements"
                value={newCategoryForm.name}
                onChange={(e) => setNewCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                maxLength={50}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewCategoryForm(prev => ({ ...prev, type: 'expense' }))}
                  className={cn(
                    "flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all text-sm",
                    newCategoryForm.type === 'expense'
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-medium">Dépense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewCategoryForm(prev => ({ ...prev, type: 'income' }))}
                  className={cn(
                    "flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all text-sm",
                    newCategoryForm.type === 'income'
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">Revenu</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>TVA</Label>
              <div className="grid grid-cols-4 gap-2">
                {vatOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewCategoryForm(prev => ({ ...prev, vat_rate: opt.value }))}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-lg border-2 transition-all text-sm font-medium",
                      newCategoryForm.vat_rate === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <div className="flex gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewCategoryForm(prev => ({ ...prev, color: color.value }))}
                    className={cn(
                      "w-8 h-8 rounded-lg transition-all flex items-center justify-center",
                      newCategoryForm.color === color.value
                        ? 'ring-2 ring-primary ring-offset-2 scale-110'
                        : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  >
                    {newCategoryForm.color === color.value && (
                      <Check className="w-4 h-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                className="gradient-primary"
                disabled={creatingCategory || !newCategoryForm.name.trim()}
                onClick={handleInlineCreate}
              >
                {creatingCategory ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Créer et appliquer
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Transaction info */}
            {transaction && (
          <div className="min-w-0 px-4 py-3 bg-muted/50 border-b">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate min-w-0 flex-1">
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
            <div className="min-w-0 px-4 py-3 border-b">
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
                  <div className="flex min-w-0 items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors">
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
            <div className="min-w-0 px-4 py-3 border-b">
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
              <ScrollArea className="max-h-[40vh] min-w-0">
              <div className="min-w-0 p-2">
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

                {(onInlineCreateCategory || onCreateCategory) && (
                  <button
                    onClick={() => {
                      if (onInlineCreateCategory) {
                        setNewCategoryForm(prev => ({
                          ...prev,
                          type: transaction?.type === 'income' ? 'income' : 'expense',
                          name: search,
                        }));
                        setShowCreateForm(true);
                      } else {
                        onCreateCategory?.();
                        onOpenChange(false);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-md transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Créer une catégorie
                  </button>
                )}

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
                        <span className="min-w-0 truncate text-left">{cat.name}</span>
                        {cat.is_system && (
                          <Lock className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
