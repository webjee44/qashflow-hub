import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Loader2,
  FolderOpen,
  Tag,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  parseZenfirstCSV, 
  ZenfirstItem, 
  ZenfirstParseResult,
  getLeafItems,
  getGroupItems,
  generateColor
} from '@/lib/zenfirstParser';
import { useCategories, Category } from '@/hooks/useCategories';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { logError } from '@/lib/logger';

interface ZenfirstImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'mapping' | 'importing' | 'done';

interface ImportItem extends ZenfirstItem {
  selected: boolean;
  existingCategory: Category | null;
  willCreate: boolean;
}

export function ZenfirstImportDialog({ open, onOpenChange }: ZenfirstImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parseResult, setParseResult] = useState<ZenfirstParseResult | null>(null);
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [importForecasts, setImportForecasts] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ groups: 0, categories: 0, forecasts: 0 });
  
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { categories, createGroup, createCategory, refetch: refetchCategories } = useCategories();

  const resetDialog = useCallback(() => {
    setStep('upload');
    setParseResult(null);
    setImportItems([]);
    setImportForecasts(true);
    setIsImporting(false);
    setImportProgress(0);
    setImportStats({ groups: 0, categories: 0, forecasts: 0 });
  }, []);

  const handleClose = useCallback(() => {
    resetDialog();
    onOpenChange(false);
  }, [onOpenChange, resetDialog]);

  const findExistingCategory = useCallback((name: string, type: 'income' | 'expense'): Category | null => {
    return categories.find(c => 
      c.name.toLowerCase().trim() === name.toLowerCase().trim() && 
      c.type === type
    ) || null;
  }, [categories]);

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      const result = parseZenfirstCSV(content);
      
      if (result.errors.length > 0) {
        toast.error(result.errors[0]);
        return;
      }
      
      if (result.items.length === 0) {
        toast.error('Aucune catégorie trouvée dans le fichier');
        return;
      }
      
      setParseResult(result);
      
      // Prepare import items with existing category matching
      const items: ImportItem[] = result.items.map((item, index) => {
        const existing = findExistingCategory(item.name, item.type);
        return {
          ...item,
          selected: true,
          existingCategory: existing,
          willCreate: !existing,
        };
      });
      
      setImportItems(items);
      setStep('mapping');
      
      toast.success(`${result.items.length} éléments détectés`);
    } catch (error) {
      logError('Error parsing file:', error);
      toast.error('Erreur lors de la lecture du fichier');
    }
  }, [findExistingCategory]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      handleFileSelect(file);
    } else {
      toast.error('Veuillez sélectionner un fichier CSV ou XLSX');
    }
  }, [handleFileSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const toggleItem = useCallback((index: number) => {
    setImportItems(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  }, []);

  const toggleAll = useCallback((selected: boolean) => {
    setImportItems(prev => prev.map(item => ({ ...item, selected })));
  }, []);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    setStep('importing');
    setImportProgress(0);
    
    const selectedItems = importItems.filter(item => item.selected);
    const groups = selectedItems.filter(item => item.isGroup);
    const leafCategories = selectedItems.filter(item => !item.isGroup);
    
    let createdGroups = 0;
    let createdCategories = 0;
    let createdForecasts = 0;
    
    const totalSteps = groups.length + leafCategories.length + 
      (importForecasts ? leafCategories.length : 0);
    let currentStep = 0;
    
    const createdGroupMap = new Map<string, string>(); // name -> id
    const createdCategoryMap = new Map<string, string>(); // name -> id
    
    try {
      // Step 1: Create groups first
      for (const group of groups) {
        if (!group.existingCategory) {
          const colorIndex = createdGroups;
          const result = await createGroup({
            name: group.name,
            color: generateColor(colorIndex, group.type),
            type: group.type,
            categoryIds: [],
          });
          
          if (result) {
            createdGroupMap.set(group.name, result.id);
            createdGroups++;
          }
        } else {
          createdGroupMap.set(group.name, group.existingCategory.id);
        }
        
        currentStep++;
        setImportProgress(Math.round((currentStep / totalSteps) * 100));
      }
      
      // Step 2: Create leaf categories with parent linking
      for (const cat of leafCategories) {
        // Determine parent_id if this category has a parent group
        const parentId = cat.parentName ? createdGroupMap.get(cat.parentName) : null;
        
        if (!cat.existingCategory) {
          const colorIndex = createdCategories;
          const result = await createCategory({
            name: cat.name,
            color: generateColor(colorIndex, cat.type),
            icon: cat.type === 'income' ? 'TrendingUp' : 'TrendingDown',
            type: cat.type,
            vat_rate: 0,
          });
          
          if (result) {
            createdCategoryMap.set(cat.name, result.id);
            createdCategories++;
            
            // Link to parent group if exists
            if (parentId) {
              try {
                await supabase
                  .from('categories')
                  .update({ parent_id: parentId })
                  .eq('id', result.id);
              } catch (error) {
                logError('Error linking category to parent:', error);
              }
            }
          }
        } else {
          createdCategoryMap.set(cat.name, cat.existingCategory.id);
          
          // Update existing category's parent if it doesn't have one but should
          if (parentId && !cat.existingCategory.parent_id) {
            try {
              await supabase
                .from('categories')
                .update({ parent_id: parentId })
                .eq('id', cat.existingCategory.id);
            } catch (error) {
              logError('Error updating category parent:', error);
            }
          }
        }
        
        currentStep++;
        setImportProgress(Math.round((currentStep / totalSteps) * 100));
      }
      
      // Step 3: Import forecasts if enabled
      if (importForecasts && parseResult && user) {
        for (const cat of leafCategories) {
          const categoryId = cat.existingCategory?.id || createdCategoryMap.get(cat.name);
          
          if (categoryId) {
            for (const [month, amount] of Object.entries(cat.monthlyAmounts)) {
              if (amount > 0) {
                try {
                  // Direct upsert to category_forecasts for all months from CSV
                  const { error } = await supabase
                    .from('category_forecasts')
                    .upsert({
                      user_id: user.id,
                      category_id: categoryId,
                      month: month, // Already in "YYYY-MM-01" format
                      expected_amount: Math.round(amount),
                      company_id: currentCompany?.id || null,
                      source: 'zenfirst_import',
                    }, {
                      onConflict: 'user_id,category_id,month',
                    });
                  
                  if (!error) {
                    createdForecasts++;
                  } else {
                    logError('Error creating forecast:', error);
                  }
                } catch (error) {
                  logError('Error creating forecast:', error);
                }
              }
            }
          }
          
          currentStep++;
          setImportProgress(Math.round((currentStep / totalSteps) * 100));
        }
      }
      
      setImportStats({
        groups: createdGroups,
        categories: createdCategories,
        forecasts: createdForecasts,
      });
      
      setStep('done');
      toast.success('Import terminé avec succès !');
    } catch (error) {
      logError('Import error:', error);
      toast.error('Erreur lors de l\'import');
      setStep('mapping');
    } finally {
      setIsImporting(false);
    }
  }, [importItems, importForecasts, parseResult, createGroup, createCategory, user, currentCompany]);

  const selectedCount = importItems.filter(i => i.selected).length;
  const toCreateCount = importItems.filter(i => i.selected && i.willCreate).length;
  const existingCount = importItems.filter(i => i.selected && !i.willCreate).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importer depuis Zenfirst
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Importez votre export Zenfirst pour créer automatiquement vos catégories et prévisions.'}
            {step === 'mapping' && 'Vérifiez les éléments à importer et ajustez si nécessaire.'}
            {step === 'importing' && 'Import en cours...'}
            {step === 'done' && 'Import terminé !'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="zenfirst-file"
              />
              <label htmlFor="zenfirst-file" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Glissez votre fichier ici</p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou cliquez pour sélectionner
                </p>
                <p className="text-xs text-muted-foreground">
                  Formats acceptés: CSV, XLSX
                </p>
              </label>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              {/* Months info */}
              {parseResult && parseResult.months.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{parseResult.months.length} mois</span> de données détectés : {parseResult.months.map(m => {
                      const d = new Date(m);
                      return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
                    }).join(', ')}
                  </p>
                </div>
              )}
              
              {/* Summary stats */}
              <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold">{selectedCount}</p>
                  <p className="text-xs text-muted-foreground">Sélectionnés</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{toCreateCount}</p>
                  <p className="text-xs text-muted-foreground">À créer</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{existingCount}</p>
                  <p className="text-xs text-muted-foreground">Existants</p>
                </div>
                {importForecasts && (
                  <div className="text-center border-l border-border pl-4">
                    <p className="text-2xl font-bold text-primary">
                      {importItems.filter(i => i.selected && !i.isGroup && i.totalAmount > 0).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Avec prévisions</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                    Tout sélectionner
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                    Tout désélectionner
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="import-forecasts"
                    checked={importForecasts}
                    onCheckedChange={(checked) => setImportForecasts(checked === true)}
                  />
                  <Label htmlFor="import-forecasts" className="text-sm cursor-pointer">
                    Importer les montants mensuels
                  </Label>
                </div>
              </div>

              {/* Items list */}
              <ScrollArea className="h-[350px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {importItems.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors",
                        !item.selected && "opacity-50"
                      )}
                      style={{ paddingLeft: `${(item.level - 1) * 20 + 8}px` }}
                    >
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItem(index)}
                      />
                      
                      {item.isGroup ? (
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      )}
                      
                      <span className="flex-1 text-sm font-medium truncate">
                        {item.name}
                      </span>
                      
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          item.type === 'income' 
                            ? "border-success/50 text-success" 
                            : "border-destructive/50 text-destructive"
                        )}
                      >
                        {item.type === 'income' ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {item.type === 'income' ? 'Revenu' : 'Dépense'}
                      </Badge>
                      
                      {item.existingCategory ? (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Existe
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                          Nouveau
                        </Badge>
                      )}
                      
                      {item.totalAmount > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {item.totalAmount.toLocaleString('fr-FR')} €
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="py-12 text-center space-y-6">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
              <div className="space-y-2">
                <p className="font-medium">Import en cours...</p>
                <Progress value={importProgress} className="w-full max-w-xs mx-auto" />
                <p className="text-sm text-muted-foreground">{importProgress}%</p>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="py-12 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-success" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">Import terminé !</p>
                <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                  {importStats.groups > 0 && (
                    <span>{importStats.groups} groupes créés</span>
                  )}
                  {importStats.categories > 0 && (
                    <span>{importStats.categories} catégories créées</span>
                  )}
                  {importStats.forecasts > 0 && (
                    <span>{importStats.forecasts} prévisions importées</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Annuler
            </Button>
          )}
          
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Retour
              </Button>
              <Button 
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                Importer {selectedCount} éléments
              </Button>
            </>
          )}
          
          {step === 'done' && (
            <Button onClick={handleClose}>
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
