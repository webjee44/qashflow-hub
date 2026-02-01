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
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

type Transaction = Tables<'transactions'>;

interface BulkCategorizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransactions: Transaction[];
  categories: Category[];
  onCategorize: (categoryId: string | null) => Promise<void>;
  isLoading?: boolean;
}

export function BulkCategorizeDialog({
  open,
  onOpenChange,
  selectedTransactions,
  categories,
  onCategorize,
  isLoading = false,
}: BulkCategorizeDialogProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

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
    await onCategorize(selectedCategoryId);
    setSelectedCategoryId(null);
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedCategoryId(null);
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
                  disabled={!selectedCategoryId || isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Tag className="w-4 h-4" />
                  )}
                  Appliquer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
