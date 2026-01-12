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
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, ArrowDownRight, ArrowUpRight, Wand2, Pencil, Check } from 'lucide-react';
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [similarTransactions, setSimilarTransactions] = useState<Transaction[]>([]);
  const [isEditingPattern, setIsEditingPattern] = useState(false);
  const [editedPattern, setEditedPattern] = useState('');

  // Calculate word frequency to detect recurring patterns (like company name)
  const getWordFrequency = () => {
    const wordFrequency = new Map<string, number>();
    allTransactions.forEach(t => {
      const words = t.description.toUpperCase().split(/\s+/);
      new Set(words).forEach(w => {
        if (w.length > 2) {
          wordFrequency.set(w, (wordFrequency.get(w) || 0) + 1);
        }
      });
    });
    return wordFrequency;
  };

  // Extract pattern locally, excluding words that appear too frequently (like company name)
  const extractLocalPattern = (description: string): SuggestionResult => {
    const cleaned = description.toUpperCase();
    const wordFrequency = getWordFrequency();
    
    // If a word appears in more than 30% of transactions, it's probably the account holder's name
    const threshold = Math.max(2, allTransactions.length * 0.3);
    
    // Mots bancaires et génériques à exclure
    const excludedWords = /^(CARTE|PAIEMENT|VIR|SEPA|PRLV|CB|PP\d*|FA\d*|F\d+|MCC|EUR|USD|INTERNET|PRELEVEMENT|COMMANDE|POUR|INST|DE|DU|LA|LE|LES|AU|AUX|\d{6,}|[A-Z0-9]{10,})$/i;
    
    const words = cleaned.split(/\s+/).filter(w => 
      w.length >= 2 &&  // Inclure les mots de 2 lettres (GD, etc.)
      !/^\d+$/.test(w) &&
      !excludedWords.test(w) &&
      (wordFrequency.get(w) || 0) < threshold
    );
    
    // Prendre les 2 premiers mots significatifs (évite les codes de commande)
    const patternWords = words.slice(0, 2);
    const pattern = patternWords.length > 0 
      ? patternWords.join(' ')
      : description.split(/\s+/)[0]?.slice(0, 10) || description.slice(0, 8).trim();
    
    return {
      pattern,
      operator: 'contains',
      ruleName: `Auto: ${category?.name || 'Catégorie'} - ${pattern}`,
    };
  };

  // Find similar uncategorized transactions
  const findSimilarTransactions = (pattern: string) => {
    if (!transaction || !pattern) return [];
    return allTransactions.filter(t => 
      t.id !== transaction.id && 
      !t.category_id &&
      t.description.toUpperCase().includes(pattern.toUpperCase())
    ).slice(0, 5);
  };

  useEffect(() => {
    if (open && transaction && category) {
      // Use local pattern extraction (instant) instead of AI call
      const localSuggestion = extractLocalPattern(transaction.description);
      setSuggestion(localSuggestion);
      setEditedPattern(localSuggestion.pattern);
      setSimilarTransactions(findSimilarTransactions(localSuggestion.pattern));
      setInitialLoading(false);
      setIsEditingPattern(false);
    } else {
      setSuggestion(null);
      setSimilarTransactions([]);
      setInitialLoading(false);
      setIsEditingPattern(false);
      setEditedPattern('');
    }
  }, [open, transaction?.id, category?.id]);

  // Update similar transactions when pattern changes
  const handlePatternChange = (newPattern: string) => {
    setEditedPattern(newPattern);
  };

  const handlePatternConfirm = () => {
    if (suggestion && editedPattern.trim()) {
      const newPattern = editedPattern.trim().toUpperCase();
      setSuggestion({
        ...suggestion,
        pattern: newPattern,
        ruleName: `Auto: ${category?.name || 'Catégorie'} - ${newPattern}`,
      });
      setSimilarTransactions(findSimilarTransactions(newPattern));
      setIsEditingPattern(false);
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
              </DialogTitle>
              <DialogDescription>
                Automatisez la catégorisation des transactions similaires
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body (scroll) */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {initialLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                    <Wand2 className="w-8 h-8 text-accent animate-pulse" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Optimisation IA</p>
                  <p className="text-xs text-muted-foreground">Analyse du pattern en cours...</p>
                </div>
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium">Pattern suggéré</span>
                    </div>
                    {!isEditingPattern && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setIsEditingPattern(true)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Modifier
                      </Button>
                    )}
                  </div>
                  {isEditingPattern ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Description contient "</span>
                      <Input
                        value={editedPattern}
                        onChange={(e) => handlePatternChange(e.target.value)}
                        className="h-7 w-40 font-mono text-sm"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handlePatternConfirm()}
                      />
                      <span className="text-sm">"</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-accent hover:text-accent"
                        onClick={handlePatternConfirm}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm">
                      Description <span className="font-semibold text-accent">{getOperatorLabel(suggestion.operator)}</span>{' '}
                      "<span className="font-mono bg-muted px-1 rounded">{suggestion.pattern}</span>"
                    </p>
                  )}
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
            ) : null}
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
