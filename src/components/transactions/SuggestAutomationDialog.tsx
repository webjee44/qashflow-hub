import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Sparkles, Loader2, Wand2, Pencil, Check, Euro, X, ExternalLink, CheckCircle2, Landmark, AlertCircle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RuleCondition, AutomationRule } from '@/hooks/useAutomationRules';
import { useBankAccountOptions } from '@/hooks/useBankAccountOptions';
import { useCompany } from '@/hooks/useCompany';
import { AutomationPreviewPanel, useAutomationRulePreview } from '@/features/automations';

type Transaction = Tables<'transactions'>;
type Category = Tables<'categories'>;

interface SuggestAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  category: Category | null;
  allTransactions: Transaction[];
  existingRuleMatch?: AutomationRule | null;
  onApplyExistingRule?: (ruleId: string) => Promise<void>;
  onCreateRule: (rule: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    action_type: string;
    target_category_id: string | null;
    conditions?: RuleCondition[];
  }) => Promise<any>;
}

interface SuggestionResult {
  pattern: string;
  operator: string;
  ruleName: string;
}

const amountOperators = [
  { value: 'greater_than', label: 'est supérieur à' },
  { value: 'less_than', label: 'est inférieur à' },
  { value: 'equals', label: 'est égal à' },
];

export function SuggestAutomationDialog({
  open,
  onOpenChange,
  transaction,
  category,
  allTransactions,
  existingRuleMatch,
  onApplyExistingRule,
  onCreateRule,
}: SuggestAutomationDialogProps) {
  const navigate = useNavigate();
  const bankAccounts = useBankAccountOptions();
  const { currentCompany } = useCompany();
  const [initialLoading, setInitialLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [applyingExisting, setApplyingExisting] = useState(false);
  const [createdRuleId, setCreatedRuleId] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  // similarTransactions state removed — server preview is now the source of truth
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);
  
  const [editedPattern, setEditedPattern] = useState('');
  const [showAmountCondition, setShowAmountCondition] = useState(false);
  const [amountOperator, setAmountOperator] = useState('greater_than');
  const [amountValue, setAmountValue] = useState('');
  const [showBankCondition, setShowBankCondition] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState('');

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

  useEffect(() => {
    if (open && transaction && category) {
      const localSuggestion = extractLocalPattern(transaction.description);
      setSuggestion(localSuggestion);
      setEditedPattern(localSuggestion.pattern);
      setInitialLoading(false);
      setShowAmountCondition(false);
      setAmountOperator('greater_than');
      setAmountValue('');
      setCreatedRuleId(null);
      setAppliedCount(0);
      setShowBankCondition(false);
      setSelectedBankAccount('');
      setAcknowledgeRisk(false);
    } else {
      setSuggestion(null);
      setInitialLoading(false);
      setEditedPattern('');
      setShowAmountCondition(false);
      setAmountOperator('greater_than');
      setAmountValue('');
      setCreatedRuleId(null);
      setAppliedCount(0);
      setShowBankCondition(false);
      setSelectedBankAccount('');
      setAcknowledgeRisk(false);
    }
  }, [open, transaction?.id, category?.id]);

  // Server-side dry-run preview (PR1) — single source of truth for impact
  const previewRequest = useMemo(() => {
    if (!currentCompany?.id || !category?.id || !editedPattern.trim()) return null;
    const conds: { condition_field: string; condition_operator: string; condition_value: string }[] = [
      { condition_field: 'description', condition_operator: 'contains', condition_value: editedPattern.trim() },
    ];
    if (showAmountCondition && amountValue.trim()) {
      conds.push({
        condition_field: 'amount',
        condition_operator: amountOperator,
        condition_value: amountValue.trim().replace(',', '.'),
      });
    }
    if (showBankCondition && selectedBankAccount) {
      conds.push({
        condition_field: 'bank_account_name',
        condition_operator: 'equals',
        condition_value: selectedBankAccount,
      });
    }
    return {
      conditions: conds,
      target_category_id: category.id,
      company_id: currentCompany.id,
    };
  }, [currentCompany?.id, category?.id, editedPattern, showAmountCondition, amountValue, amountOperator, showBankCondition, selectedBankAccount]);

  const { preview, loading: previewLoading, error: previewError } = useAutomationRulePreview({
    request: previewRequest,
    enabled: open,
  });

  const lowSafety = !!(preview && preview.safety_score < 0.6);




  const handleCreateRule = async () => {
    if (!suggestion || !category) return;
    const finalPattern = editedPattern.trim().toUpperCase();
    if (!finalPattern) return;

    setCreating(true);
    try {
      const conditions: RuleCondition[] = [
        {
          condition_field: 'description',
          condition_operator: suggestion.operator,
          condition_value: finalPattern,
        },
      ];

      if (showAmountCondition && amountValue.trim()) {
        conditions.push({
          condition_field: 'amount',
          condition_operator: amountOperator,
          condition_value: amountValue.trim().replace(',', '.'),
        });
      }

      if (showBankCondition && selectedBankAccount) {
        conditions.push({
          condition_field: 'bank_account_name',
          condition_operator: 'equals',
          condition_value: selectedBankAccount,
        });
      }

      const ruleName = showAmountCondition && amountValue.trim()
        ? `Auto: ${category.name} - ${finalPattern} + ${amountValue} €`
        : `Auto: ${category.name} - ${finalPattern}`;

      const result = await onCreateRule({
        name: ruleName,
        condition_field: 'description',
        condition_operator: suggestion.operator,
        condition_value: finalPattern,
        action_type: 'categorize',
        target_category_id: category.id,
        conditions,
      });

      if (result?.id) {
        setCreatedRuleId(result.id);
        setAppliedCount(result.match_count || 0);
      } else {
        onOpenChange(false);
      }
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
            {createdRuleId ? (
              /* ── Success state ── */
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-success" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Règle créée avec succès</p>
                  {appliedCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {appliedCount} transaction{appliedCount > 1 ? 's' : ''} catégorisée{appliedCount > 1 ? 's' : ''} automatiquement
                    </p>
                  )}
                </div>
              </div>
            ) : initialLoading ? (
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

                {/* Existing rule banner — info, not blocker */}
                {existingRuleMatch && (
                  <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 text-sm">
                        <p className="font-medium">Une règle active couvre déjà cette transaction</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          « {existingRuleMatch.name} ». Vous pouvez l'appliquer maintenant aux transactions similaires, ou créer une règle plus précise ci-dessous.
                        </p>
                      </div>
                    </div>
                    {onApplyExistingRule && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={applyingExisting}
                        onClick={async () => {
                          setApplyingExisting(true);
                          try {
                            await onApplyExistingRule(existingRuleMatch.id);
                            onOpenChange(false);
                          } finally {
                            setApplyingExisting(false);
                          }
                        }}
                      >
                        {applyingExisting ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Appliquer la règle existante
                      </Button>
                    )}
                  </div>
                )}

                {/* Pattern suggéré (toujours éditable inline) */}
                <div className="border border-accent/30 bg-accent/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium">Pattern suggéré</span>
                    <Pencil className="w-3 h-3 text-muted-foreground ml-auto" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm whitespace-nowrap">
                      Description <span className="font-semibold text-accent">{getOperatorLabel(suggestion.operator)}</span> "
                    </span>
                    <Input
                      value={editedPattern}
                      onChange={(e) => setEditedPattern(e.target.value)}
                      className="h-7 flex-1 min-w-[120px] font-mono text-sm"
                      placeholder="MOT-CLÉ"
                    />
                    <span className="text-sm">"</span>
                  </div>
                </div>

                {/* Filtre montant optionnel */}
                {showAmountCondition ? (
                  <div className="border border-accent/30 bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Euro className="w-4 h-4 text-accent" />
                        ET le montant...
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setShowAmountCondition(false);
                          setAmountValue('');
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Select value={amountOperator} onValueChange={setAmountOperator}>
                        <SelectTrigger className="w-[160px] h-8 text-sm">
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
                          placeholder="100"
                          value={amountValue}
                          onChange={(e) => setAmountValue(e.target.value)}
                          className="pr-8 h-8 text-sm"
                          autoFocus
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAmountCondition(true)}
                    className="w-full border-dashed border-accent/30 text-accent hover:bg-accent/5 hover:border-accent"
                  >
                    <Euro className="w-4 h-4 mr-2" />
                    + Ajouter un critère de montant
                  </Button>
                )}

                {/* Bank Account Condition (optional) */}
                {showBankCondition ? (
                  <div className="border border-accent/30 bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-accent" />
                        ET le compte bancaire...
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setShowBankCondition(false);
                          setSelectedBankAccount('');
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                      <SelectTrigger className="h-8 text-sm">
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
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBankCondition(true)}
                    className="w-full border-dashed border-accent/30 text-accent hover:bg-accent/5 hover:border-accent"
                  >
                    <Landmark className="w-4 h-4 mr-2" />
                    + Ajouter un critère de compte bancaire
                  </Button>
                ) : null}

                {/* Server-side dry-run preview (PR1) — single source of truth */}
                {previewRequest && (
                  <AutomationPreviewPanel
                    preview={preview}
                    loading={previewLoading}
                    error={previewError}
                  />
                )}

                {lowSafety && (
                  <label className="flex items-start gap-2 text-xs text-amber-700 bg-amber-500/5 border border-amber-500/30 rounded-md p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledgeRisk}
                      onChange={(e) => setAcknowledgeRisk(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>Je comprends les risques (score de sécurité bas) et confirme la création.</span>
                  </label>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer (always visible) */}
          <div className="border-t border-border bg-background p-4">
            <DialogFooter className="gap-2 sm:gap-0">
              {createdRuleId ? (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Fermer
                  </Button>
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/automatisations');
                    }}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Voir la règle
                  </Button>
                </>
              ) : (preview && preview.matched_uncategorized === 0) ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCreateRule}
                    disabled={creating || !suggestion || (lowSafety && !acknowledgeRisk)}
                    className="gap-2"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Créer quand même
                  </Button>
                  <Button onClick={() => onOpenChange(false)}>
                    Fermer
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Non merci
                  </Button>
                  <Button
                    onClick={handleCreateRule}
                    disabled={creating || !suggestion || (lowSafety && !acknowledgeRisk)}
                    className="gap-2"
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Créer la règle
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
