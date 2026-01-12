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

  useEffect(() => {
    if (open && transaction && category) {
      analyzeTransaction();
    } else {
      setSuggestion(null);
      setSimilarTransactions([]);
    }
  }, [open, transaction?.id]);

  const analyzeTransaction = async () => {
    if (!transaction) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('suggest-automation', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          description: transaction.description,
          categoryName: category?.name,
        },
      });

      if (error) {
        console.error('Error suggesting automation:', error);
        // Fallback: use simple extraction
        const words = transaction.description.split(' ');
        const pattern = words[0] || transaction.description.slice(0, 10);
        setSuggestion({
          pattern,
          operator: 'contains',
          ruleName: `Auto: ${category?.name} - ${pattern}`,
        });
      } else {
        setSuggestion(data);
      }

      // Find similar transactions based on the pattern
      if (data?.pattern || suggestion?.pattern) {
        const patternToUse = data?.pattern || suggestion?.pattern;
        const similar = allTransactions.filter(t => 
          t.id !== transaction.id && 
          !t.category_id &&
          t.description.toLowerCase().includes(patternToUse.toLowerCase())
        );
        setSimilarTransactions(similar.slice(0, 5));
      }
    } catch (err) {
      console.error('Error:', err);
      // Fallback
      const words = transaction.description.split(' ');
      const pattern = words[0] || transaction.description.slice(0, 10);
      setSuggestion({
        pattern,
        operator: 'contains',
        ruleName: `Auto: ${category?.name} - ${pattern}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Update similar transactions when suggestion changes
  useEffect(() => {
    if (suggestion?.pattern && transaction) {
      const similar = allTransactions.filter(t => 
        t.id !== transaction.id && 
        !t.category_id &&
        t.description.toLowerCase().includes(suggestion.pattern.toLowerCase())
      );
      setSimilarTransactions(similar.slice(0, 5));
    }
  }, [suggestion?.pattern]);

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
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Créer une automatisation ?
          </DialogTitle>
          <DialogDescription>
            Automatisez la catégorisation des transactions similaires
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyse en cours...</p>
          </div>
        ) : suggestion ? (
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
                <span className="text-sm font-medium">Pattern suggéré par l'IA</span>
              </div>
              <p className="text-sm">
                Description <span className="font-semibold text-accent">{getOperatorLabel(suggestion.operator)}</span>{' '}
                "<span className="font-mono bg-muted px-1 rounded">{suggestion.pattern}</span>"
              </p>
            </div>

            {/* Transactions similaires */}
            {similarTransactions.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                    {similarTransactions.length}
                  </span>
                  transaction{similarTransactions.length > 1 ? 's' : ''} similaire{similarTransactions.length > 1 ? 's' : ''} non catégorisée{similarTransactions.length > 1 ? 's' : ''}
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
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
                      <span className={cn(
                        "font-medium shrink-0 ml-2",
                        t.type === 'income' ? 'text-success' : 'text-destructive'
                      )}>
                        {t.type === 'income' ? '+' : '-'}{formatAmount(Number(t.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {similarTransactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Aucune autre transaction similaire non catégorisée trouvée
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Non merci
          </Button>
          <Button 
            onClick={handleCreateRule} 
            disabled={loading || creating || !suggestion}
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
      </DialogContent>
    </Dialog>
  );
}
