import { useState, useMemo, useCallback } from 'react';
import { Scissors, X, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tables } from '@/integrations/supabase/types';
import { Category } from '@/hooks/useCategories';

type Transaction = Tables<'transactions'>;

interface SplitLine {
  id: string;
  categoryId: string | null;
  amount: number;
}

interface SplitTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  incomeCategories: Category[];
  expenseCategories: Category[];
  onSplit: (splits: { categoryId: string | null; amount: number }[]) => Promise<void>;
  isLoading?: boolean;
}

export function SplitTransactionDialog({
  open,
  onOpenChange,
  transaction,
  incomeCategories,
  expenseCategories,
  onSplit,
  isLoading = false,
}: SplitTransactionDialogProps) {
  const [splitCount, setSplitCount] = useState(2);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);

  const originalAmount = transaction ? Number(transaction.amount) : 0;

  // Calculate equitable distribution
  const generateSplits = useCallback((count: number, total: number) => {
    if (count < 2) return [];
    
    const baseAmount = Math.floor((total / count) * 100) / 100;
    const remainder = Number((total - baseAmount * count).toFixed(2));

    return Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      categoryId: null,
      amount: i === count - 1 ? Number((baseAmount + remainder).toFixed(2)) : baseAmount,
    }));
  }, []);

  // Apply split count
  const handleApplySplit = useCallback(() => {
    if (splitCount >= 2) {
      setSplitLines(generateSplits(splitCount, originalAmount));
    }
  }, [splitCount, originalAmount, generateSplits]);

  // Update a line's category
  const updateLineCategory = useCallback((lineId: string, categoryId: string | null) => {
    setSplitLines(prev =>
      prev.map(line =>
        line.id === lineId ? { ...line, categoryId } : line
      )
    );
  }, []);

  // Update a line's amount
  const updateLineAmount = useCallback((lineId: string, amount: number) => {
    setSplitLines(prev =>
      prev.map(line =>
        line.id === lineId ? { ...line, amount } : line
      )
    );
  }, []);

  // Remove a line (minimum 2)
  const removeLine = useCallback((lineId: string) => {
    setSplitLines(prev => {
      if (prev.length <= 2) return prev;
      return prev.filter(line => line.id !== lineId);
    });
  }, []);

  // Calculate total
  const total = useMemo(() => {
    return splitLines.reduce((sum, line) => sum + line.amount, 0);
  }, [splitLines]);

  // Validation: check if total matches original (±0.01€)
  const isValid = useMemo(() => {
    if (splitLines.length < 2) return false;
    return Math.abs(total - originalAmount) <= 0.01;
  }, [total, originalAmount, splitLines.length]);

  // Format amount for display
  const formatAmount = useCallback((amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!isValid || isLoading) return;
    
    await onSplit(
      splitLines.map(line => ({
        categoryId: line.categoryId,
        amount: line.amount,
      }))
    );
    
    // Reset state
    setSplitCount(2);
    setSplitLines([]);
    onOpenChange(false);
  }, [isValid, isLoading, splitLines, onSplit, onOpenChange]);

  // Reset on close
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSplitCount(2);
      setSplitLines([]);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  // Get categories based on transaction type
  const relevantCategories = transaction?.type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            Diviser en plusieurs
          </DialogTitle>
          {transaction && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {transaction.description}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Split count input */}
          <div className="flex items-center gap-3">
            <Label htmlFor="split-count" className="whitespace-nowrap">
              Nombre de transactions :
            </Label>
            <Input
              id="split-count"
              type="number"
              min={2}
              max={20}
              value={splitCount}
              onChange={(e) => setSplitCount(Math.max(2, parseInt(e.target.value) || 2))}
              className="w-20"
            />
            <Button onClick={handleApplySplit} variant="secondary">
              Appliquer
            </Button>
          </div>

          {/* Split lines table */}
          {splitLines.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_150px_40px] gap-3 px-4 py-2 bg-muted/50 text-sm font-medium text-muted-foreground">
                <div>Catégorie</div>
                <div className="text-right">Montant TTC</div>
                <div></div>
              </div>

              {/* Lines */}
              <div className="divide-y divide-border">
                {splitLines.map((line) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-[1fr_150px_40px] gap-3 px-4 py-3 items-center"
                  >
                    {/* Category select */}
                    <Select
                      value={line.categoryId || 'uncategorized'}
                      onValueChange={(value) =>
                        updateLineCategory(line.id, value === 'uncategorized' ? null : value)
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          'w-full',
                          !line.categoryId && 'bg-warning/20 border-warning text-warning dark:bg-warning/10'
                        )}
                      >
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncategorized" className="text-muted-foreground">
                          Non catégorisé
                        </SelectItem>
                        {relevantCategories.length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>
                                {transaction?.type === 'income' ? 'Encaissements' : 'Décaissements'}
                              </SelectLabel>
                              {relevantCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: cat.color }}
                                    />
                                    <span className="truncate">{cat.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Amount input */}
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount}
                      onChange={(e) =>
                        updateLineAmount(line.id, parseFloat(e.target.value) || 0)
                      }
                      className="text-right"
                    />

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeLine(line.id)}
                      disabled={splitLines.length <= 2}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className={cn('font-semibold tabular-nums', !isValid && 'text-destructive')}>
                    {formatAmount(total)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Montant à répartir</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatAmount(originalAmount)}</span>
                    {isValid ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation message */}
          {splitLines.length > 0 && !isValid && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Le total doit correspondre au montant à répartir (±0,01 €)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading || splitLines.length < 2}
          >
            {isLoading ? 'Division en cours...' : 'Diviser'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
