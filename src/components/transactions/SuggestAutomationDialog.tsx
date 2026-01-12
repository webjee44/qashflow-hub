import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ArrowDownRight, ArrowUpRight, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Transaction = Tables<'transactions'>;
type Category = Tables<'categories'>;

interface SuggestAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  category: Category | null;
  allTransactions: Transaction[];
  onCreateRule: (rule: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    action_type: string;
    target_category_id: string | null;
  }) => Promise<any>;
}

interface SuggestionResult {
  pattern: string;
  operator: string;
  ruleName: string;
}

export function SuggestAutomationDialog({
  open,
  onOpenChange,
  transaction,
  category,
  allTransactions,
  onCreateRule,
}: SuggestAutomationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [similarTransactions, setSimilarTransactions] = useState<Transaction[]>([]);

  // Extraction locale de pattern (instantanée)
  const extractLocalPattern = (description: string): SuggestionResult => {
    // Nettoyer la description
    const cleaned = description.toUpperCase();
    
    // Patterns connus de fournisseurs (premier mot significatif)
    const words = cleaned.split(/\s+/).filter(w => 
      w.length > 2 && 
      !/^\d+$/.test(w) && // Ignorer les nombres purs
      !/^(CARTE|PAIEMENT|VIR|SEPA|PRLV|CB|PP\d+|FA\d+|MCC|EUR|USD)$/i.test(w) // Ignorer les mots bancaires
    );
    
    // Prendre le premier mot significatif comme pattern
    const pattern = words[0] || description.slice(0, 8).trim();
    
    return {
      pattern,
      operator: 'contains',
      ruleName: `Auto: ${category?.name || 'Catégorie'} - ${pattern}`,
    };
  };

  // Trouver les transactions similaires
  const findSimilarTransactions = (pattern: string) => {
    if (!transaction || !pattern) return [];
    return allTransactions.filter(t => 
      t.id !== transaction.id && 
      !t.category_id &&
      t.description.toLowerCase().includes(pattern.toLowerCase())
    ).slice(0, 5);
  };

  useEffect(() => {
    if (open && transaction && category) {
      // 1. Pattern local immédiat
      const localSuggestion = extractLocalPattern(transaction.description);
      setSuggestion(localSuggestion);
      setSimilarTransactions(findSimilarTransactions(localSuggestion.pattern));
      
      // 2. Raffinement IA en arrière-plan (optionnel)
      refineWithAI(transaction.description, localSuggestion);
    } else {
      setSuggestion(null);
      setSimilarTransactions([]);
    }
  }, [open, transaction?.id]);

  const refineWithAI = async (description: string, localSuggestion: SuggestionResult) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('suggest-automation', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          description,
          categoryName: category?.name,
        },
      });

      if (!error && data?.pattern && data.pattern !== localSuggestion.pattern) {
        // L'IA a trouvé un meilleur pattern
        setSuggestion(data);
        setSimilarTransactions(findSimilarTransactions(data.pattern));
      }
    } catch (err) {
      console.error('AI refinement error:', err);
      // Garder le pattern local
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!suggestion || !category) return;

    setCreating(true);
    try {
      await onCreateRule({
        name: suggestion.ruleName,
        condition_field: 'description',
        condition_operator: suggestion.operator,
        condition_value: suggestion.pattern,
        action_type: 'categorize',
        target_category_id: category.id,
      });
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount));
  };

  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case 'contains': return 'contient';
      case 'starts_with': return 'commence par';
      case 'ends_with': return 'se termine par';
      case 'equals': return 'est égal à';
      default: return 'contient';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Créer une automatisation ?
                {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </DialogTitle>
              <DialogDescription>
                Automatisez la catégorisation des transactions similaires
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body (scroll) */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {suggestion ? (
              <div className="space-y-4">
                {/* Transaction catégorisée */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Vous venez de catégoriser :</p>
                  <p className="font-medium text-sm truncate">{transaction?.description}</p>
                  <Badge
                    variant="outline"
                    className="mt-2"
                    style={{ borderColor: category?.color, color: category?.color }}
                  >
                    → {category?.name}
                  </Badge>
                </div>

                {/* Pattern suggéré */}
                <div className="border border-accent/30 bg-accent/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium">Pattern suggéré</span>
                  </div>
                  <p className="text-sm">
                    Description <span className="font-semibold text-accent">{getOperatorLabel(suggestion.operator)}</span>{' '}
                    "<span className="font-mono bg-muted px-1 rounded">{suggestion.pattern}</span>"
                  </p>
                </div>

                {/* Transactions similaires */}
                {similarTransactions.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {similarTransactions.length}
                      </span>
                      transaction{similarTransactions.length > 1 ? 's' : ''} similaire{similarTransactions.length > 1 ? 's' : ''} non catégorisée{similarTransactions.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                      {similarTransactions.map(t => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {t.type === 'income' ? (
                              <ArrowUpRight className="w-4 h-4 text-success shrink-0" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-destructive shrink-0" />
                            )}
                            <span className="truncate">{t.description}</span>
                          </div>
                          <span
                            className={cn(
                              "font-medium shrink-0 ml-2",
                              t.type === 'income' ? 'text-success' : 'text-destructive'
                            )}
                          >
                            {t.type === 'income' ? '+' : '-'}{formatAmount(Number(t.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Aucune autre transaction similaire non catégorisée trouvée
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Préparation de la suggestion...</p>
              </div>
            )}
          </div>

          {/* Footer (always visible) */}
          <div className="border-t border-border bg-background p-4">
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Non merci
              </Button>
              <Button
                onClick={handleCreateRule}
                disabled={creating || !suggestion}
                className="gap-2"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Créer la règle
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
