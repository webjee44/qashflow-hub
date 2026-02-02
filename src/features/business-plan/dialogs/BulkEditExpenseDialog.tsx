// ============================================
// Bulk Edit Expense Dialog
// 3-step workflow: Download → Upload → Preview & Apply
// ============================================

import { useState, useCallback, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  Plus, 
  Pencil, 
  Trash2,
  AlertCircle,
  X,
  ArrowRight,
  FileUp
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadExpenseTemplate } from '@/lib/excelExpenseTemplate';
import { parseExpenseExcel, type ImportDiff } from '@/lib/excelExpenseParser';
import type { BPFixedExpense } from '@/hooks/useBPFixedExpenses';
import { useBPFixedExpenses } from '@/features/business-plan/hooks/useBPFixedExpenses';
import { cn } from '@/lib/utils';

interface BulkEditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: BPFixedExpense[];
  onComplete?: () => void;
}

type Step = 'download' | 'upload' | 'preview';

export function BulkEditExpenseDialog({
  open,
  onOpenChange,
  expenses,
  onComplete,
}: BulkEditExpenseDialogProps) {
  const [step, setStep] = useState<Step>('download');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { createExpense, updateExpense, deleteExpense } = useBPFixedExpenses();

  const resetState = useCallback(() => {
    setStep('download');
    setDiff(null);
    setIsDragging(false);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, resetState]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadExpenseTemplate(expenses);
      toast.success('Fichier Excel téléchargé');
      setStep('upload');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Format de fichier invalide. Utilisez un fichier .xlsx');
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseExpenseExcel(file, expenses);
      setDiff(result);
      setStep('preview');
    } catch (error) {
      toast.error('Erreur lors de la lecture du fichier');
      console.error(error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [expenses]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleApply = async () => {
    if (!diff) return;
    
    setIsApplying(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Apply deletions first
      for (const id of diff.toDelete) {
        try {
          await deleteExpense.mutateAsync(id);
          successCount++;
        } catch {
          errorCount++;
        }
      }

      // Apply updates
      for (const { id, changes } of diff.toUpdate) {
        try {
          await updateExpense.mutateAsync({ id, ...changes });
          successCount++;
        } catch {
          errorCount++;
        }
      }

      // Apply creations
      for (const newExpense of diff.toCreate) {
        try {
          await createExpense.mutateAsync(newExpense);
          successCount++;
        } catch {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`${successCount} opération(s) effectuée(s)`);
      } else {
        toast.warning(`${successCount} réussie(s), ${errorCount} erreur(s)`);
      }

      onComplete?.();
      handleOpenChange(false);
    } catch (error) {
      toast.error("Erreur lors de l'application des modifications");
      console.error(error);
    } finally {
      setIsApplying(false);
    }
  };

  const totalChanges = diff 
    ? diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length 
    : 0;

  const hasBlockingErrors = diff && diff.errors.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Édition en masse des charges fixes
          </DialogTitle>
          <DialogDescription>
            Téléchargez le fichier Excel, modifiez-le, puis réimportez-le.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-4">
          <StepIndicator 
            number={1} 
            label="Télécharger" 
            active={step === 'download'} 
            completed={step !== 'download'} 
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator 
            number={2} 
            label="Importer" 
            active={step === 'upload'} 
            completed={step === 'preview'} 
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator 
            number={3} 
            label="Appliquer" 
            active={step === 'preview'} 
            completed={false} 
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Download */}
          {step === 'download' && (
            <div className="space-y-6 p-4">
              <div className="bg-muted/50 rounded-lg p-6 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Download className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Télécharger le modèle Excel</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Le fichier contiendra {expenses.length} charge(s) existante(s) 
                    + 50 lignes vides pour en ajouter.
                  </p>
                </div>
                <Button 
                  onClick={handleDownload} 
                  disabled={isDownloading}
                  className="gap-2"
                  size="lg"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  Télécharger le modèle Excel
                </Button>
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">Le fichier inclut :</p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Menus déroulants pour les catégories et périodicités</li>
                  <li>Toutes les colonnes requises pré-formatées</li>
                  <li>Instructions intégrées</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Upload */}
          {step === 'upload' && (
            <div className="space-y-4 p-4">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                  isDragging 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                {isParsing ? (
                  <div className="space-y-3">
                    <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Analyse du fichier...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FileUp className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium">Glissez votre fichier Excel ici</p>
                      <p className="text-sm text-muted-foreground">
                        ou cliquez pour parcourir
                      </p>
                    </div>
                    <Badge variant="secondary">.xlsx uniquement</Badge>
                  </div>
                )}
              </div>

              <Button 
                variant="outline" 
                onClick={() => setStep('download')}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                Retélécharger le modèle
              </Button>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && diff && (
            <div className="space-y-4 p-4">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                {diff.toCreate.length > 0 && (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-3 w-3" />
                    {diff.toCreate.length} à créer
                  </Badge>
                )}
                {diff.toUpdate.length > 0 && (
                  <Badge className="gap-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Pencil className="h-3 w-3" />
                    {diff.toUpdate.length} à modifier
                  </Badge>
                )}
                {diff.toDelete.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <Trash2 className="h-3 w-3" />
                    {diff.toDelete.length} à supprimer
                  </Badge>
                )}
                {diff.unchanged > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {diff.unchanged} inchangée(s)
                  </Badge>
                )}
                {diff.errors.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {diff.errors.length} erreur(s)
                  </Badge>
                )}
              </div>

              {/* Details */}
              <ScrollArea className="h-[280px] rounded-md border">
                <div className="p-4 space-y-4">
                  {/* Errors */}
                  {diff.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Erreurs à corriger
                      </h4>
                      {diff.errors.map((err, i) => (
                        <div 
                          key={i} 
                          className="text-sm bg-destructive/10 text-destructive p-2 rounded"
                        >
                          Ligne {err.row}: {err.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Creations */}
                  {diff.toCreate.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Nouvelles charges
                      </h4>
                      {diff.toCreate.map((exp, i) => (
                        <div 
                          key={i} 
                          className="text-sm bg-accent/50 p-2 rounded flex justify-between"
                        >
                          <span>{exp.name}</span>
                          <span className="text-muted-foreground">
                            {exp.monthly_amount.toLocaleString('fr-FR')} €
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Updates */}
                  {diff.toUpdate.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary flex items-center gap-2">
                        <Pencil className="h-4 w-4" />
                        Modifications
                      </h4>
                      {diff.toUpdate.map(({ id, changes }, i) => {
                        const original = expenses.find(e => e.id === id);
                        return (
                          <div 
                            key={i} 
                            className="text-sm bg-muted p-2 rounded"
                          >
                            <span className="font-medium">{changes.name || original?.name}</span>
                            <span className="text-muted-foreground ml-2">
                              → {changes.monthly_amount?.toLocaleString('fr-FR') || original?.monthly_amount} €
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Deletions */}
                  {diff.toDelete.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-destructive flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Suppressions
                      </h4>
                      {diff.toDelete.map((id, i) => {
                        const original = expenses.find(e => e.id === id);
                        return (
                          <div 
                            key={i} 
                            className="text-sm bg-destructive/10 text-destructive p-2 rounded"
                          >
                            {original?.name || id}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* No changes */}
                  {totalChanges === 0 && diff.errors.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune modification détectée</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <Button 
                variant="outline" 
                onClick={() => {
                  setDiff(null);
                  setStep('upload');
                }}
                className="w-full gap-2"
              >
                <Upload className="h-4 w-4" />
                Importer un autre fichier
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
          
          {step === 'preview' && totalChanges > 0 && (
            <Button 
              onClick={handleApply} 
              disabled={isApplying || hasBlockingErrors}
              className="gap-2"
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Appliquer {totalChanges} modification(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Step indicator component
function StepIndicator({ 
  number, 
  label, 
  active, 
  completed 
}: { 
  number: number; 
  label: string; 
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div 
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
          active && "bg-primary text-primary-foreground",
          completed && "bg-primary/20 text-primary",
          !active && !completed && "bg-muted text-muted-foreground"
        )}
      >
        {completed ? <CheckCircle2 className="h-4 w-4" /> : number}
      </div>
      <span className={cn(
        "text-sm hidden sm:inline",
        active ? "font-medium" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  );
}
