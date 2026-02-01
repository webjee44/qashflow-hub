import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRevenueStreams } from '@/features/business-plan/hooks/useRevenueStreams';
import { useForecasts } from '@/hooks/useForecasts';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowRight, Check, FileDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BPImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'select' | 'category' | 'preview';

export function BPImportDialog({ open, onOpenChange }: BPImportDialogProps) {
  const { streams, getForecast, isLoading: streamsLoading } = useRevenueStreams();
  const { months, upsertForecast } = useForecasts();
  const { categories } = useCategories();
  
  const [step, setStep] = useState<Step>('select');
  const [selectedStreams, setSelectedStreams] = useState<Set<string>>(new Set());
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  // Filter only active streams
  const activeStreams = useMemo(() => 
    streams.filter(s => s.is_active !== false), 
    [streams]
  );

  // Income categories for destination
  const incomeCategories = useMemo(() => 
    categories.filter(c => c.type === 'income'),
    [categories]
  );

  // Calculate monthly TTC amounts for selected streams
  const monthlyTotals = useMemo(() => {
    return months.map((month) => {
      let totalHT = 0;
      let totalTTC = 0;
      
      activeStreams.forEach(stream => {
        if (selectedStreams.has(stream.id)) {
          const monthlyHT = getForecast(stream.id, month);
          const vatRate = (stream as any).vat_rate || 0.20;
          totalHT += monthlyHT;
          totalTTC += monthlyHT * (1 + vatRate);
        }
      });
      
      return { month, totalHT, totalTTC };
    });
  }, [months, activeStreams, selectedStreams, getForecast]);

  // Total HT for selected streams (first 12 months)
  const getStreamYearlyHT = (streamId: string) => {
    return months.slice(0, 12).reduce((sum, month) => {
      return sum + getForecast(streamId, month);
    }, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleToggleStream = (streamId: string) => {
    setSelectedStreams(prev => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedStreams.size === activeStreams.length) {
      setSelectedStreams(new Set());
    } else {
      setSelectedStreams(new Set(activeStreams.map(s => s.id)));
    }
  };

  const handleImport = async () => {
    if (!targetCategoryId) {
      toast.error('Veuillez sélectionner une catégorie de destination');
      return;
    }

    setIsImporting(true);
    
    try {
      // Import each month's TTC total
      const promises = monthlyTotals
        .filter(m => m.totalTTC > 0)
        .map(({ month, totalTTC }) => 
          upsertForecast.mutateAsync({
            categoryId: targetCategoryId,
            month,
            expectedAmount: Math.round(totalTTC),
          })
        );
      
      await Promise.all(promises);
      
      toast.success(`${promises.length} mois importés avec succès`);
      handleClose();
    } catch (error) {
      toast.error('Erreur lors de l\'import');
      console.error(error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedStreams(new Set());
    setTargetCategoryId('');
    onOpenChange(false);
  };

  const canProceedToCategory = selectedStreams.size > 0;
  const canProceedToPreview = !!targetCategoryId;

  const totalSelectedHT = monthlyTotals.reduce((sum, m) => sum + m.totalHT, 0);
  const totalSelectedTTC = monthlyTotals.reduce((sum, m) => sum + m.totalTTC, 0);

  if (streamsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-primary" />
            Import depuis Business Plan
          </DialogTitle>
          <DialogDescription>
            Importez le chiffre d'affaires prévisionnel du BP vers les prévisions de trésorerie (converti en TTC)
          </DialogDescription>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-4">
          {(['select', 'category', 'preview'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step === s 
                  ? "bg-primary text-primary-foreground" 
                  : i < ['select', 'category', 'preview'].indexOf(step)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}>
                {i < ['select', 'category', 'preview'].indexOf(step) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1: Select streams */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Sélectionnez les flux de revenus à importer
              </p>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedStreams.size === activeStreams.length ? 'Désélectionner tout' : 'Tout sélectionner'}
              </Button>
            </div>

            {activeStreams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun flux de revenus configuré dans le Business Plan
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {activeStreams.map(stream => {
                  const yearlyHT = getStreamYearlyHT(stream.id);
                  const vatRate = (stream as any).vat_rate || 0.20;
                  const yearlyTTC = yearlyHT * (1 + vatRate);
                  
                  return (
                    <label
                      key={stream.id}
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <Checkbox
                        checked={selectedStreams.has(stream.id)}
                        onCheckedChange={() => handleToggleStream(stream.id)}
                      />
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stream.color || 'hsl(var(--primary))' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{stream.name}</p>
                        <p className="text-xs text-muted-foreground">
                          TVA: {(vatRate * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          HT: {formatCurrency(yearlyHT)}
                        </p>
                        <p className="font-medium text-success">
                          TTC: {formatCurrency(yearlyTTC)}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedStreams.size > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 flex justify-between items-center">
                <span className="text-sm font-medium">
                  {selectedStreams.size} flux sélectionné(s)
                </span>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total 6 mois TTC</p>
                  <p className="font-semibold text-success">{formatCurrency(totalSelectedTTC)}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button 
                onClick={() => setStep('category')}
                disabled={!canProceedToCategory}
              >
                Continuer
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select category */}
        {step === 'category' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choisissez la catégorie de destination pour les prévisions
            </p>

            <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie..." />
              </SelectTrigger>
              <SelectContent>
                {incomeCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('select')}>
                Retour
              </Button>
              <Button 
                onClick={() => setStep('preview')}
                disabled={!canProceedToPreview}
              >
                Aperçu
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aperçu des montants TTC à importer
            </p>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Mois</th>
                    <th className="px-4 py-2 text-right font-medium">HT</th>
                    <th className="px-4 py-2 text-right font-medium">TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {monthlyTotals.map(({ month, totalHT, totalTTC }) => (
                    <tr key={month.toISOString()} className="hover:bg-muted/20">
                      <td className="px-4 py-2 capitalize">
                        {format(month, 'MMMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {formatCurrency(totalHT)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-success">
                        {formatCurrency(totalTTC)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(totalSelectedHT)}</td>
                    <td className="px-4 py-2 text-right text-success">{formatCurrency(totalSelectedTTC)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm">
                <strong>Destination :</strong>{' '}
                {incomeCategories.find(c => c.id === targetCategoryId)?.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Les montants existants seront remplacés par les nouvelles valeurs.
              </p>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('category')}>
                Retour
              </Button>
              <Button 
                onClick={handleImport}
                disabled={isImporting}
                className="bg-success hover:bg-success/90"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Importer
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
