import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useCategories, CategoryGroup, Category } from '@/hooks/useCategories';
import { useCompany } from '@/hooks/useCompany';
import { useForecasts } from '@/hooks/useForecasts';
import { format, startOfMonth, isBefore, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Copy, Check, CheckCircle2, TrendingUp, Plus, Minus, Link2, ChevronsUpDown, ChevronsDownUp, MoreHorizontal, Edit3, Trash2, Eye, EyeOff, ArrowUpRight, FileText, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { ForecastChart } from './ForecastChart';
import { PeriodSelector } from './PeriodSelector';
import { TransactionDetailDialog } from './TransactionDetailDialog';
import { supabase } from '@/integrations/supabase/client';

const COLLAPSED_GROUPS_KEY = 'forecast-collapsed-groups';
const SHOW_ALL_CATEGORIES_KEY = 'forecast-show-all-categories';

// Helper to determine the period type for a given month
type MonthPeriodType = 'past' | 'current' | 'future';

const getMonthPeriodType = (month: Date): MonthPeriodType => {
  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const monthStart = startOfMonth(month);
  
  if (isBefore(monthStart, currentMonthStart)) return 'past';
  if (isSameMonth(month, today)) return 'current';
  return 'future';
};

// Progress bar for current month cells
// For expenses: green = on track (actual ≤ forecast), red = over budget
// For income: green = on track (actual ≥ some threshold), always green
// Shows a ✓ icon when realization is ≥ 100%
const ProgressBar = ({ actual, forecast, type }: { actual: number; forecast: number; type: 'income' | 'expense' | 'balance' }) => {
  if (forecast === 0 && actual === 0) return null;
  const absActual = Math.abs(actual);
  const absForecast = Math.abs(forecast);
  const pct = absForecast > 0 ? Math.min(100, (absActual / absForecast) * 100) : (actual !== 0 ? 100 : 0);
  
  // Use a small tolerance (1€) for rounding differences
  const isComplete = absForecast > 0 && absActual >= absForecast - 1;
  const overBudget = type === 'expense' && absForecast > 0 && absActual > absForecast + 1;
  
  // Color logic: expenses turn red only when over budget, otherwise green/primary
  const colorClass = overBudget 
    ? 'bg-destructive' 
    : type === 'balance' 
      ? 'bg-primary' 
      : 'bg-success';
  
  return (
    <div className="flex items-center gap-1 mt-1">
      <div className="flex-1 h-1.5 bg-muted/50 rounded-full">
        <div 
          className={cn(colorClass, "h-full rounded-full transition-all")}
          style={{ width: `${pct}%` }} 
        />
      </div>
      {isComplete && !overBudget && (
        <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />
      )}
      {overBudget && (
        <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />
      )}
    </div>
  );
};

export function ForecastTable() {
  const { currentCompany, isLoading: companyLoading } = useCompany();
  const { categories, loading: categoriesLoading, getGroupedCategories, updateCategory, deleteCategory } = useCategories();
  const { 
    months, 
    getForecast, 
    getForecastSource,
    isManualOverride,
    clearForecastOverride,
    getActual, 
    getVatForecast, 
    getVatActual,
    getNetVatForecast,
    getNetVatActual,
    getUncategorized,
    getIncomeForecastTotal,
    getPayableOutflow,
    getPayableOutflowByCategory,
    getPayableOutflowUncategorized,
    getOpeningBalance,
    getClosingBalance,
    upsertForecast, 
    isLoading: forecastsLoading,
    extendBefore,
    extendAfter,
    shrinkBefore,
    shrinkAfter,
    resetPeriod,
    monthsBefore,
    monthsAfter,
  } = useForecasts();
  
  // Track if user has been warned about override (per session)
  const [overrideWarningShown, setOverrideWarningShown] = useState(false);
  const [pendingOverrideCell, setPendingOverrideCell] = useState<{ categoryId: string; monthIndex: number; currentValue: number } | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showCopyOption, setShowCopyOption] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ categoryId: string; monthIndex: number; type: 'income' | 'expense' } | null>(null);
  const [growthPercent, setGrowthPercent] = useState<string>('5');
  const [showGrowthInput, setShowGrowthInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Category edit/delete state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [transactionCount, setTransactionCount] = useState<number>(0);

  // Show all categories toggle (including empty ones) - default TRUE (show all)
  const [showAllCategories, setShowAllCategories] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SHOW_ALL_CATEGORIES_KEY);
      // Default to true = show all categories; user can manually hide if desired
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Persist show all categories state
  useEffect(() => {
    localStorage.setItem(SHOW_ALL_CATEGORIES_KEY, JSON.stringify(showAllCategories));
  }, [showAllCategories]);

  // Transaction detail dialog state
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [transactionDetailData, setTransactionDetailData] = useState<{
    categoryId: string | null;
    categoryName: string;
    categoryColor: string;
    categoryType: 'income' | 'expense';
    month: Date;
    forecast: number;
  } | null>(null);

  const openTransactionDetail = (category: Category, monthIndex: number) => {
    const forecast = getForecast(category.id, months[monthIndex]);
    setTransactionDetailData({
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color,
      categoryType: category.type,
      month: months[monthIndex],
      forecast,
    });
    setTransactionDetailOpen(true);
  };

  // Show loading during initial data fetch
  // Include forecastsLoading to prevent blank screen on navigation
  const isInitialLoading = companyLoading || !currentCompany || forecastsLoading;
  const isCategoriesLoading = categoriesLoading && categories.length === 0;

  // Get grouped categories
  const incomeGroups = useMemo(() => {
    const groups = getGroupedCategories('income');
    return groups.map(g => ({ ...g, children: g.children.filter(c => !c.is_system) })).filter(g => g.group || g.children.length > 0);
  }, [categories]);
  const expenseGroups = useMemo(() => {
    const groups = getGroupedCategories('expense');
    return groups.map(g => ({ ...g, children: g.children.filter(c => !c.is_system) })).filter(g => g.group || g.children.length > 0);
  }, [categories]);

  // Get all group IDs for default collapsed state
  const allGroupIds = useMemo(() => 
    [...incomeGroups, ...expenseGroups]
      .filter(g => g.group)
      .map(g => g.group!.id),
    [incomeGroups, expenseGroups]
  );
  
  // Section-level collapse (Encaissements / Décaissements)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('forecast-collapsed-sections');
      if (saved) return new Set(JSON.parse(saved));
      return new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem('forecast-collapsed-sections', JSON.stringify([...collapsedSections]));
  }, [collapsedSections]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // Collapsed groups state with localStorage persistence - DEFAULT COLLAPSED
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_GROUPS_KEY);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
      // No saved state - will be set to all collapsed once groups load
      return new Set();
    } catch {
      return new Set();
    }
  });

  // Initialize to collapsed by default when groups first load
  const [hasInitialized, setHasInitialized] = useState(false);
  useEffect(() => {
    if (!hasInitialized && allGroupIds.length > 0) {
      const saved = localStorage.getItem(COLLAPSED_GROUPS_KEY);
      if (!saved) {
        // First load with no saved state: collapse all groups
        setCollapsedGroups(new Set(allGroupIds));
      }
      setHasInitialized(true);
    }
  }, [allGroupIds, hasInitialized]);

  // Save collapsed state to localStorage
  useEffect(() => {
    if (hasInitialized) {
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroups]));
    }
  }, [collapsedGroups, hasInitialized]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
    setCollapsedSections(new Set());
  };

  const collapseAll = () => {
    setCollapsedGroups(new Set(allGroupIds));
    setCollapsedSections(new Set(['income', 'expense']));
  };

  const allCollapsed = allGroupIds.length > 0 && allGroupIds.every(id => collapsedGroups.has(id)) && collapsedSections.has('income') && collapsedSections.has('expense');
  const allExpanded = allGroupIds.length > 0 && !allGroupIds.some(id => collapsedGroups.has(id)) && !collapsedSections.has('income') && !collapsedSections.has('expense');

  // Separate categories by type (for backward compatibility)
  const incomeCategories = categories.filter(c => c.type === 'income' && !c.is_system);
  const expenseCategories = categories.filter(c => c.type === 'expense' && !c.is_system);

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonth = (date: Date) => {
    return format(date, 'MMM yyyy', { locale: fr });
  };

  const handleCellClick = (categoryId: string, monthIndex: number, currentValue: number) => {
    // Don't start editing another cell if we have a pending save operation
    // This prevents clearing save state when clicking outside the popover
    if (pendingSave || showCopyOption || isSaving) return;
    
    const cellKey = `${categoryId}-${monthIndex}`;
    setEditingCell(cellKey);
    setEditValue(currentValue.toString());
  };

  const handleSave = async (categoryId: string, monthIndex: number, mode: 'single' | 'copy' | 'growth' = 'single') => {
    // Prevent duplicate saves
    if (isSaving) return;
    
    setIsSaving(true);
    const value = parseFloat(editValue) || 0;
    
    try {
      if (mode === 'copy') {
        // Save to current month and all following months with same value
        const promises = [];
        for (let i = monthIndex; i < months.length; i++) {
          promises.push(upsertForecast.mutateAsync({
            categoryId,
            month: months[i],
            expectedAmount: value,
          }));
        }
        await Promise.all(promises);
      } else if (mode === 'growth') {
        // Save with progressive growth - handle comma as decimal separator
        const normalizedGrowth = growthPercent.replace(',', '.');
        const growth = parseFloat(normalizedGrowth) || 0;
        const promises = [];
        let currentValue = value;
        for (let i = monthIndex; i < months.length; i++) {
          promises.push(upsertForecast.mutateAsync({
            categoryId,
            month: months[i],
            expectedAmount: Math.round(currentValue),
          }));
          currentValue = currentValue * (1 + growth / 100);
        }
        await Promise.all(promises);
      } else {
        // Save only to current month
        await upsertForecast.mutateAsync({
          categoryId,
          month: months[monthIndex],
          expectedAmount: value,
        });
      }
    } finally {
      setEditingCell(null);
      setShowCopyOption(false);
      setPendingSave(null);
      setShowGrowthInput(false);
      setIsSaving(false);
    }
  };

  const handleInputBlur = (categoryId: string, monthIndex: number, type: 'income' | 'expense') => {
    // Only show copy option if there are following months
    if (monthIndex < months.length - 1) {
      setPendingSave({ categoryId, monthIndex, type });
      setShowCopyOption(true);
      setShowGrowthInput(false);
    } else {
      handleSave(categoryId, monthIndex, 'single');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, categoryId: string, monthIndex: number, type: 'income' | 'expense') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (monthIndex < months.length - 1) {
        setPendingSave({ categoryId, monthIndex, type });
        setShowCopyOption(true);
        setShowGrowthInput(false);
      } else {
        handleSave(categoryId, monthIndex, 'single');
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setShowCopyOption(false);
      setPendingSave(null);
      setShowGrowthInput(false);
    }
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Calculate totals for a month (amounts are used as entered, without HT/TTC conversion)
  const getMonthTotal = useCallback((type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => {
    const cats = type === 'income' ? incomeCategories : expenseCategories;
    return cats.reduce((sum, cat) => {
      if (valueType === 'forecast') {
        return sum + getForecast(cat.id, months[monthIndex]);
      }
      return sum + Math.abs(getActual(cat.id, months[monthIndex]));
    }, 0);
  }, [incomeCategories, expenseCategories, getForecast, getActual, months]);

  // Get VAT for a month
  const getMonthVat = useCallback((type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => {
    return valueType === 'forecast'
      ? getVatForecast(type, months[monthIndex])
      : getVatActual(type, months[monthIndex]);
  }, [getVatForecast, getVatActual, months]);

  // Get colspan for a month based on its period type
  const getMonthColspan = (month: Date): number => {
    const periodType = getMonthPeriodType(month);
    return periodType === 'current' ? 2 : 1;
  };

  const renderCell = (category: Category, monthIndex: number, type: 'income' | 'expense') => {
    const categoryId = category.id;
    const cellKey = `${categoryId}-${monthIndex}`;
    const forecast = getForecast(categoryId, months[monthIndex]);
    const actual = getActual(categoryId, months[monthIndex]);
    const source = getForecastSource(categoryId, months[monthIndex]);
    const isEditing = editingCell === cellKey;
    const showingCopyForThis = showCopyOption && pendingSave?.categoryId === categoryId && pendingSave?.monthIndex === monthIndex;
    const isIncomeCategory = pendingSave?.type === 'income';
    
    // For expenses, include payable invoices for this category
    const payableForCategory = type === 'expense' ? getPayableOutflowByCategory(categoryId, months[monthIndex]) : 0;
    const totalForecast = forecast + payableForCategory;
    const hasPayables = payableForCategory > 0;
    
    const periodType = getMonthPeriodType(months[monthIndex]);
    const isVariable = category.forecast_mode === 'percent_of_revenue';
    
    // Color logic: green if actual >= forecast (for income) or actual <= forecast (for expense)
    const hasActual = actual !== 0;
    const isPositive = type === 'income' 
      ? actual >= totalForecast 
      : Math.abs(actual) <= totalForecast;

    const isBpSource = source === 'bp_import' || source === 'bp_synced';

    // Past: only show actual
    if (periodType === 'past') {
      return (
        <td key={cellKey} className="p-0 border-r border-border min-w-[90px]">
          <div 
            className={cn(
              "px-3 py-2 text-right bg-muted/20 transition-colors",
              hasActual && "text-foreground",
              hasActual && "cursor-pointer hover:bg-muted/40"
            )}
            onClick={() => hasActual && openTransactionDetail(category, monthIndex)}
          >
            {hasActual ? formatValue(Math.abs(actual)) : '—'}
          </div>
        </td>
      );
    }

    // Variable categories (percent_of_revenue): non-editable computed cells
    if (isVariable) {
      const incomeForecastTotal = getIncomeForecastTotal(months[monthIndex]);
      const forecastPercent = category.forecast_percent ?? 0;
      const hasOverride = isManualOverride(categoryId, months[monthIndex]);
      
      const handleVariableCellClick = () => {
        if (pendingSave || showCopyOption || isSaving) return;
        if (!hasOverride && !overrideWarningShown) {
          setPendingOverrideCell({ categoryId, monthIndex, currentValue: forecast });
          return;
        }
        handleCellClick(categoryId, monthIndex, forecast);
      };

      const handleResetToAuto = () => {
        clearForecastOverride.mutate({ categoryId, month: months[monthIndex] });
      };

      const variableTooltip = hasOverride
        ? "Valeur manuelle — clic droit pour revenir en auto"
        : `${forecastPercent}% × ${formatValue(incomeForecastTotal)} (CA prévu) = ${formatValue(forecast)}`;
      
      if (periodType === 'future') {
        return (
          <td key={cellKey} className="p-0 border-r border-border min-w-[90px] relative">
            <div 
              className={cn(
                "px-3 py-2 text-right cursor-pointer hover:bg-violet-500/20 transition-colors relative",
                hasOverride ? "bg-violet-500/15 border-l-2 border-violet-500" : "bg-violet-500/10"
              )}
              onClick={() => {
                if (!isEditing && !showingCopyForThis) {
                  handleVariableCellClick();
                }
              }}
              onContextMenu={(e) => {
                if (hasOverride) {
                  e.preventDefault();
                  handleResetToAuto();
                }
              }}
            >
              {hasOverride && !isEditing && (
                <Edit3 className="w-3 h-3 text-violet-500 absolute top-1 left-1 opacity-70" />
              )}
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleInputBlur(categoryId, monthIndex, type)}
                  onKeyDown={(e) => handleKeyDown(e, categoryId, monthIndex, type)}
                  className="w-full bg-background border border-primary rounded px-2 py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={totalForecast > 0 ? "text-foreground" : "text-muted-foreground"}>
                      {totalForecast > 0 ? formatValue(totalForecast) : '—'}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[280px]">
                    {variableTooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {showingCopyForThis && (
              <Popover open={true} onOpenChange={(open) => {
                if (!open && !isSaving) {
                  handleSave(categoryId, monthIndex, 'single');
                }
              }}>
                <PopoverTrigger asChild>
                  <span className="absolute inset-0" />
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" side="bottom" align="end">
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={() => handleSave(categoryId, monthIndex, 'single')}>
                      <Check className="w-4 h-4" /> Ce mois uniquement
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start gap-2 text-primary" onClick={() => handleSave(categoryId, monthIndex, 'copy')}>
                      <Copy className="w-4 h-4" /> Copier sur les mois suivants
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </td>
        );
      }
      
      // Current month: actual + editable forecast for variable
      return (
        <td key={cellKey} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
          <div className="flex">
            <div 
              className={cn(
                "flex-1 px-3 py-2 text-right border-r border-border/50 bg-primary/5 transition-colors",
                hasActual && "text-foreground",
                hasActual && "cursor-pointer hover:bg-primary/10"
              )}
              onClick={() => hasActual && openTransactionDetail(category, monthIndex)}
            >
              {hasActual ? formatValue(Math.abs(actual)) : '—'}
              <ProgressBar actual={Math.abs(actual)} forecast={totalForecast} type={type} />
            </div>
            
            <div className="flex-1 relative">
              <div 
                className={cn(
                  "px-3 py-2 text-right cursor-pointer hover:bg-violet-500/20 transition-colors relative h-full",
                  hasOverride ? "bg-violet-500/15 border-l-2 border-violet-500" : "bg-violet-500/10"
                )}
                onClick={() => {
                  if (!isEditing && !showingCopyForThis) {
                    handleVariableCellClick();
                  }
                }}
                onContextMenu={(e) => {
                  if (hasOverride) {
                    e.preventDefault();
                    handleResetToAuto();
                  }
                }}
              >
                {hasOverride && !isEditing && (
                  <Edit3 className="w-3 h-3 text-violet-500 absolute top-1 left-1 opacity-70" />
                )}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleInputBlur(categoryId, monthIndex, type)}
                    onKeyDown={(e) => handleKeyDown(e, categoryId, monthIndex, type)}
                    className="w-full bg-background border border-primary rounded px-2 py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={totalForecast > 0 ? "text-foreground" : "text-muted-foreground"}>
                        {totalForecast > 0 ? formatValue(totalForecast) : '—'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[280px]">
                      {variableTooltip}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {showingCopyForThis && (
                <Popover open={true} onOpenChange={(open) => {
                  if (!open && !isSaving) {
                    handleSave(categoryId, monthIndex, 'single');
                  }
                }}>
                  <PopoverTrigger asChild>
                    <span className="absolute inset-0" />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" side="bottom" align="end">
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={() => handleSave(categoryId, monthIndex, 'single')}>
                        <Check className="w-4 h-4" /> Ce mois uniquement
                      </Button>
                      <Button variant="ghost" size="sm" className="justify-start gap-2 text-primary" onClick={() => handleSave(categoryId, monthIndex, 'copy')}>
                        <Copy className="w-4 h-4" /> Copier sur les mois suivants
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </td>
      );
    }

    // Future: only show forecast (editable) + payables if any
    if (periodType === 'future') {
      return (
        <td key={cellKey} className="p-0 border-r border-border min-w-[90px]">
          <Popover open={showingCopyForThis} onOpenChange={(open) => {
            if (!open && showingCopyForThis && !isSaving) {
              handleSave(categoryId, monthIndex, 'single');
            }
          }}>
            <PopoverTrigger asChild>
              <div 
                className={cn(
                  "px-3 py-2 text-right cursor-pointer hover:bg-primary/5 transition-colors relative",
                  isBpSource && "bg-primary/5",
                  hasPayables && "bg-amber-500/10"
                )}
                onClick={() => !isEditing && !showingCopyForThis && handleCellClick(categoryId, monthIndex, forecast)}
              >
                {isBpSource && forecast > 0 && !isEditing && !hasPayables && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link2 className="w-3 h-3 text-primary absolute top-1 left-1 opacity-60" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {source === 'bp_synced' ? 'Synchronisé avec Prévisions' : 'Importé depuis Prévisions'}
                    </TooltipContent>
                  </Tooltip>
                )}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleInputBlur(categoryId, monthIndex, type)}
                    onKeyDown={(e) => handleKeyDown(e, categoryId, monthIndex, type)}
                    className="w-full bg-background border border-primary rounded px-2 py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : hasPayables ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={cn("text-muted-foreground", forecast > 0 && "text-foreground")}>
                      {forecast > 0 ? formatValue(forecast) : '—'}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <FileText className="w-2.5 h-2.5" />
                          +{formatValue(payableForCategory)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Factures fournisseurs en attente
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <span className={cn(
                    "text-muted-foreground",
                    totalForecast > 0 && "text-foreground"
                  )}>
                    {totalForecast > 0 ? formatValue(totalForecast) : '—'}
                  </span>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" side="bottom" align="end">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => handleSave(categoryId, monthIndex, 'single')}
                >
                  <Check className="w-4 h-4" />
                  Ce mois uniquement
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2 text-primary"
                  onClick={() => handleSave(categoryId, monthIndex, 'copy')}
                >
                  <Copy className="w-4 h-4" />
                  Copier sur les mois suivants
                </Button>
                {isIncomeCategory && (
                  <>
                    {!showGrowthInput ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start gap-2 text-success"
                        onClick={() => setShowGrowthInput(true)}
                      >
                        <TrendingUp className="w-4 h-4" />
                        Copier + augmenter par mois
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">+</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={growthPercent}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9,.-]/g, '');
                            setGrowthPercent(value);
                          }}
                          className="w-16 h-7 text-sm text-center"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSave(categoryId, monthIndex, 'growth');
                            }
                          }}
                        />
                        <span className="text-sm text-muted-foreground">% / mois</span>
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleSave(categoryId, monthIndex, 'growth')}
                        >
                          OK
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </td>
      );
    }

    // Current: show both actual + forecast with progress bar
    return (
      <td key={cellKey} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
        <div className="flex">
          {/* Actual - clickable to open detail */}
          <div 
            className={cn(
              "flex-1 px-3 py-2 text-right border-r border-border/50 bg-primary/5 transition-colors",
              hasActual && "text-foreground",
              hasActual && "cursor-pointer hover:bg-primary/10"
            )}
            onClick={() => hasActual && openTransactionDetail(category, monthIndex)}
          >
            {hasActual ? formatValue(Math.abs(actual)) : '—'}
            <ProgressBar actual={Math.abs(actual)} forecast={totalForecast} type={type} />
          </div>
          
          {/* Forecast (editable) */}
          <Popover open={showingCopyForThis} onOpenChange={(open) => {
            if (!open && showingCopyForThis && !isSaving) {
              handleSave(categoryId, monthIndex, 'single');
            }
          }}>
            <PopoverTrigger asChild>
              <div 
                className={cn(
                  "flex-1 px-3 py-2 text-right cursor-pointer hover:bg-primary/5 transition-colors relative",
                  isBpSource && "bg-primary/5",
                  hasPayables && "bg-amber-500/10"
                )}
                onClick={() => !isEditing && !showingCopyForThis && handleCellClick(categoryId, monthIndex, forecast)}
              >
                {isBpSource && forecast > 0 && !isEditing && !hasPayables && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link2 className="w-3 h-3 text-primary absolute top-1 left-1 opacity-60" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {source === 'bp_synced' ? 'Synchronisé avec Prévisions' : 'Importé depuis Prévisions'}
                    </TooltipContent>
                  </Tooltip>
                )}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleInputBlur(categoryId, monthIndex, type)}
                    onKeyDown={(e) => handleKeyDown(e, categoryId, monthIndex, type)}
                    className="w-full bg-background border border-primary rounded px-2 py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : hasPayables ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={cn("text-muted-foreground", forecast > 0 && "text-foreground")}>
                      {forecast > 0 ? formatValue(forecast) : '—'}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <FileText className="w-2.5 h-2.5" />
                          +{formatValue(payableForCategory)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Factures fournisseurs en attente
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <span className={cn(
                    "text-muted-foreground",
                    totalForecast > 0 && "text-foreground"
                  )}>
                    {totalForecast > 0 ? formatValue(totalForecast) : '—'}
                  </span>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" side="bottom" align="end">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => handleSave(categoryId, monthIndex, 'single')}
                >
                  <Check className="w-4 h-4" />
                  Ce mois uniquement
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2 text-primary"
                  onClick={() => handleSave(categoryId, monthIndex, 'copy')}
                >
                  <Copy className="w-4 h-4" />
                  Copier sur les mois suivants
                </Button>
                {isIncomeCategory && (
                  <>
                    {!showGrowthInput ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start gap-2 text-success"
                        onClick={() => setShowGrowthInput(true)}
                      >
                        <TrendingUp className="w-4 h-4" />
                        Copier + augmenter par mois
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">+</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={growthPercent}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9,.-]/g, '');
                            setGrowthPercent(value);
                          }}
                          className="w-16 h-7 text-sm text-center"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSave(categoryId, monthIndex, 'growth');
                            }
                          }}
                        />
                        <span className="text-sm text-muted-foreground">% / mois</span>
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleSave(categoryId, monthIndex, 'growth')}
                        >
                          OK
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </td>
    );
  };

  // Calculate group total
  const getGroupTotal = useCallback((group: CategoryGroup, monthIndex: number, valueType: 'forecast' | 'actual') => {
    return group.children.reduce((sum, cat) => {
      if (valueType === 'forecast') {
        return sum + getForecast(cat.id, months[monthIndex]);
      }
      return sum + Math.abs(getActual(cat.id, months[monthIndex]));
    }, 0);
  }, [getForecast, getActual, months]);

  const renderGroupRow = (group: CategoryGroup, type: 'income' | 'expense') => {
    if (!group.group) return null; // Don't render header for ungrouped categories
    
    const groupId = group.group.id;
    const isCollapsed = collapsedGroups.has(groupId);
    const textClass = 'text-foreground';
    
    return (
      <tr 
        key={`group-${groupId}`}
        className="group/row cursor-pointer transition-colors duration-200 hover:bg-muted/60 border-b border-border"
        onClick={() => toggleGroup(groupId)}
      >
        <td className="p-3 sticky left-0 z-10 border-r border-border transition-colors duration-200 group-hover/row:bg-muted/60">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center bg-muted transition-colors duration-200 group-hover/row:bg-foreground/10">
              {isCollapsed ? (
                <Plus className="w-3 h-3 text-muted-foreground transition-colors group-hover/row:text-foreground" />
              ) : (
                <Minus className="w-3 h-3 text-muted-foreground transition-colors group-hover/row:text-foreground" />
              )}
            </div>
            <span className={cn("font-semibold text-xs uppercase tracking-wider", textClass)}>
              {group.group.name}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {group.children.length}
            </span>
          </div>
        </td>
        {months.map((month, monthIndex) => {
          const forecastTotal = getGroupTotal(group, monthIndex, 'forecast');
          const actualTotal = getGroupTotal(group, monthIndex, 'actual');
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px] transition-colors duration-200 group-hover/row:bg-muted/60">
                <div className={cn("px-3 py-2 text-right font-semibold text-xs", textClass)}>
                  {actualTotal > 0 ? formatValue(actualTotal) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px] transition-colors duration-200 group-hover/row:bg-muted/60">
                <div className={cn("px-3 py-2 text-right font-semibold text-xs", textClass)}>
                  {forecastTotal > 0 ? formatValue(forecastTotal) : '—'}
                </div>
              </td>
            );
          }
          
          // Current month: both
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px] transition-colors duration-200 group-hover/row:bg-muted/60">
              <div className="flex">
                <div className={cn("flex-1 px-3 py-2 text-right border-r border-border/50 font-semibold text-xs", textClass)}>
                  {actualTotal > 0 ? formatValue(actualTotal) : '—'}
                </div>
                <div className={cn("flex-1 px-3 py-2 text-right font-semibold text-xs", textClass)}>
                  {forecastTotal > 0 ? formatValue(forecastTotal) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  // Handle category edit
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditDialogOpen(true);
  };

  // Handle category delete with transaction count check
  const handleDeleteClick = async (category: Category) => {
    setCategoryToDelete(category);
    
    // Fetch transaction count
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', category.id)
      .is('deleted_at', null);
    
    setTransactionCount(count || 0);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (categoryToDelete) {
      deleteCategory(categoryToDelete.id);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  const renderCategoryRow = (category: typeof categories[0], index: number, type: 'income' | 'expense', isChild: boolean = false) => {
    return (
      <motion.tr
        key={category.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ delay: 0.03 * index }}
        className="border-b border-border hover:bg-muted/20 transition-colors group"
      >
        <td className={cn(
          "p-3 sticky left-0 z-10 bg-card border-r border-border",
          isChild && "pl-8"
        )}>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: category.color }}
            />
            <span className="font-medium text-foreground">{category.name}</span>
            {category.forecast_mode === 'percent_of_revenue' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/15 rounded px-1.5 py-0.5">
                % {category.forecast_percent ?? 0}
              </span>
            )}
            {category.vat_rate > 0 && (
              <span className="text-xs text-muted-foreground">
                ({(category.vat_rate * 100).toFixed(0)}%)
              </span>
            )}
            
            {/* Quick actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover">
                <DropdownMenuItem onClick={() => handleEditCategory(category)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteClick(category)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
        {months.map((_, monthIndex) => renderCell(category, monthIndex, type))}
      </motion.tr>
    );
  };

  // Helper to check if a category has any amount on displayed period
  const hasAnyAmount = useCallback((categoryId: string): boolean => {
    return months.some(month => {
      const forecast = getForecast(categoryId, month);
      const actual = Math.abs(getActual(categoryId, month));
      return forecast > 0 || actual > 0;
    });
  }, [months, getForecast, getActual]);

  const renderGroupedSection = (groups: CategoryGroup[], type: 'income' | 'expense', startIndex: number) => {
    let currentIndex = startIndex;
    
    return groups.map((group) => {
      const groupId = group.group?.id || 'ungrouped';
      const isCollapsed = group.group ? collapsedGroups.has(groupId) : false;
      
      const totalChildren = group.children;

      // Filter categories without any amounts (unless showAllCategories is enabled)
      const visibleChildren = showAllCategories 
        ? totalChildren 
        : totalChildren.filter(cat => hasAnyAmount(cat.id));
      
      // Skip ungrouped section if empty
      if (visibleChildren.length === 0 && !group.group) return null;
      
      const elements = [];
      
      // Always render group header if it's a proper group (even if empty)
      if (group.group) {
        // Pass total children to keep badge accurate even when filtering “actives only”
        elements.push(renderGroupRow({ ...group, children: totalChildren }, type));
      }
      
      // Render children if not collapsed (or if no group header)
      if (!isCollapsed && visibleChildren.length > 0) {
        visibleChildren.forEach((category) => {
          elements.push(renderCategoryRow(category, currentIndex, type, !!group.group));
          currentIndex++;
        });
      }
      
      return elements;
    });
  };

  const renderTotalRow = (label: string, type: 'income' | 'expense', variant: 'subtotal' | 'total' = 'subtotal') => {
    const bgClass = variant === 'total' ? 'bg-primary/10' : 'bg-muted/50';
    const textClass = 'text-foreground';
    
    return (
      <tr className={cn("font-semibold", bgClass)}>
        <td className="p-3 sticky left-0 z-10 bg-inherit border-r border-border">
          {label}
        </td>
        {months.map((month, monthIndex) => {
          const forecastTotal = getMonthTotal(type, monthIndex, 'forecast');
          const actualTotal = getMonthTotal(type, monthIndex, 'actual');
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn("px-3 py-2 text-right", textClass)}>
                  {actualTotal > 0 ? formatValue(actualTotal) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn("px-3 py-2 text-right", textClass)}>
                  {forecastTotal > 0 ? formatValue(forecastTotal) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div className={cn("flex-1 px-3 py-2 text-right border-r border-border/50", textClass)}>
                  {actualTotal > 0 ? formatValue(actualTotal) : '—'}
                  <ProgressBar actual={actualTotal} forecast={forecastTotal} type={type} />
                </div>
                <div className={cn("flex-1 px-3 py-2 text-right", textClass)}>
                  {forecastTotal > 0 ? formatValue(forecastTotal) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  const renderVatRow = (label: string, type: 'income' | 'expense') => {
    const textClass = 'text-muted-foreground';
    
    return (
      <tr className="bg-muted/30 text-sm">
        <td className="p-2 pl-6 sticky left-0 z-10 bg-muted/30 border-r border-border italic">
          {label}
        </td>
        {months.map((month, monthIndex) => {
          const forecastVat = getMonthVat(type, monthIndex, 'forecast');
          const actualVat = getMonthVat(type, monthIndex, 'actual');
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn("px-3 py-1.5 text-right", textClass)}>
                  {actualVat > 0 ? formatValue(actualVat) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn("px-3 py-1.5 text-right", textClass)}>
                  {forecastVat > 0 ? formatValue(forecastVat) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border min-w-[160px]">
              <div className="flex">
                <div className={cn("flex-1 px-3 py-1.5 text-right border-r border-border/50", textClass)}>
                  {actualVat > 0 ? formatValue(actualVat) : '—'}
                </div>
                <div className={cn("flex-1 px-3 py-1.5 text-right", textClass)}>
                  {forecastVat > 0 ? formatValue(forecastVat) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  const renderTtcRow = (label: string, type: 'income' | 'expense') => {
    const textClass = 'text-foreground';
    
    return (
      <tr className="font-bold bg-muted/60">
        <td className={cn("p-3 sticky left-0 z-10 bg-muted/60 border-r border-border", textClass)}>
          {label}
        </td>
        {months.map((month, monthIndex) => {
          // getMonthTotal now returns TTC for forecasts, already TTC for actuals
          let forecastTtc = getMonthTotal(type, monthIndex, 'forecast');
          let actualTtc = getMonthTotal(type, monthIndex, 'actual');
          
          // For expenses, add net VAT to pay (only for forecasts, not actuals)
          if (type === 'expense') {
            const netVatForecast = getNetVatForecast(months[monthIndex]);
            if (netVatForecast > 0) forecastTtc += netVatForecast;
          }
          
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn("px-3 py-2 text-right", textClass)}>
                  {actualTtc > 0 ? formatValue(actualTtc) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn("px-3 py-2 text-right", textClass)}>
                  {forecastTtc > 0 ? formatValue(forecastTtc) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div className={cn("flex-1 px-3 py-2 text-right border-r border-border/50", textClass)}>
                  {actualTtc > 0 ? formatValue(actualTtc) : '—'}
                  <ProgressBar actual={actualTtc} forecast={forecastTtc} type={type} />
                </div>
                <div className={cn("flex-1 px-3 py-2 text-right", textClass)}>
                  {forecastTtc > 0 ? formatValue(forecastTtc) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  // Collapsible section header row with inline TTC totals
  const renderSectionHeaderRow = (label: string, type: 'income' | 'expense', sectionId: string) => {
    const isCollapsed = collapsedSections.has(sectionId);
    const bgClass = type === 'income' ? 'bg-success/10' : 'bg-destructive/10';
    const stickyBgClass = type === 'income' ? 'bg-success/10' : 'bg-destructive/10';
    
    return (
      <tr 
        className={cn("font-semibold cursor-pointer transition-colors duration-200 border-b border-border", bgClass)}
        onClick={() => toggleSection(sectionId)}
      >
        <td className={cn("p-3 sticky left-0 z-10 border-r border-border", stickyBgClass)}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center bg-background/50">
              {isCollapsed ? (
                <Plus className="w-3 h-3 text-muted-foreground" />
              ) : (
                <Minus className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
            <span className="text-foreground">{label}</span>
          </div>
        </td>
        {months.map((month, monthIndex) => {
          // getMonthTotal now returns TTC for forecasts, already TTC for actuals
          let forecastTtc = getMonthTotal(type, monthIndex, 'forecast');
          let actualTtc = getMonthTotal(type, monthIndex, 'actual');
          
          if (type === 'expense') {
            const netVatForecast = getNetVatForecast(months[monthIndex]);
            if (netVatForecast > 0) forecastTtc += netVatForecast;
          }
          
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn("px-3 py-2 text-right font-semibold text-foreground")}>
                  {actualTtc > 0 ? formatValue(actualTtc) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn("px-3 py-2 text-right font-semibold text-foreground")}>
                  {forecastTtc > 0 ? formatValue(forecastTtc) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div className={cn("flex-1 px-3 py-2 text-right border-r border-border/50 font-semibold text-foreground")}>
                  {actualTtc > 0 ? formatValue(actualTtc) : '—'}
                  <ProgressBar actual={actualTtc} forecast={forecastTtc} type={type} />
                </div>
                <div className={cn("flex-1 px-3 py-2 text-right font-semibold text-foreground")}>
                  {forecastTtc > 0 ? formatValue(forecastTtc) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  const renderUncategorizedRow = (type: 'income' | 'expense') => {
    const label = type === 'income' ? 'Non catégorisés (encaissements)' : 'Non catégorisés (décaissements)';
    
    // Check if there are any uncategorized transactions for this type
    const hasUncategorized = months.some(month => getUncategorized(type, month) > 0);
    if (!hasUncategorized) return null;

    const openUncategorizedDetail = (monthIndex: number) => {
      setTransactionDetailData({
        categoryId: null,
        categoryName: type === 'income' ? 'Non catégorisés (encaissements)' : 'Non catégorisés (décaissements)',
        categoryColor: 'hsl(var(--muted-foreground))',
        categoryType: type,
        month: months[monthIndex],
        forecast: 0,
      });
      setTransactionDetailOpen(true);
    };
    
    return (
      <tr className="bg-muted/30 border-b border-border">
        <td className="p-3 sticky left-0 z-10 bg-muted/30 border-r border-border">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">{label}</span>
          </div>
        </td>
        {months.map((month, monthIndex) => {
          const amount = getUncategorized(type, month);
          const periodType = getMonthPeriodType(month);
          
          // Uncategorized only shows actual (no forecast)
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className="px-3 py-2 text-right text-muted-foreground">
                  —
                </div>
              </td>
            );
          }
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div 
                  className={cn(
                    "px-3 py-2 text-right font-medium text-muted-foreground",
                    amount > 0 && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => amount > 0 && openUncategorizedDetail(monthIndex)}
                >
                  {amount > 0 ? formatValue(amount) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div 
                  className={cn(
                    "flex-1 px-3 py-2 text-right border-r border-border/50 font-medium text-muted-foreground",
                    amount > 0 && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => amount > 0 && openUncategorizedDetail(monthIndex)}
                >
                  {amount > 0 ? formatValue(amount) : '—'}
                </div>
                <div className="flex-1 px-3 py-2 text-right text-muted-foreground">
                  —
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  const renderVatToPayRow = () => {
    return (
      <tr className="bg-muted/30 text-sm">
        <td className="p-2 pl-6 sticky left-0 z-10 bg-muted/30 border-r border-border italic text-muted-foreground">
          TVA à décaisser
        </td>
        {months.map((month, monthIndex) => {
          const vatToPayForecast = getNetVatForecast(months[monthIndex]);
          const vatToPayActual = getNetVatActual(months[monthIndex]);
          
          const hasActual = vatToPayActual !== 0;
          const hasForecast = vatToPayForecast !== 0;
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-1.5 text-right",
                  vatToPayActual > 0 ? "text-muted-foreground" : vatToPayActual < 0 ? "text-success" : "text-muted-foreground"
                )}>
                  {hasActual ? formatValue(Math.max(0, vatToPayActual)) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-1.5 text-right",
                  vatToPayForecast > 0 ? "text-muted-foreground" : vatToPayForecast < 0 ? "text-success" : "text-muted-foreground"
                )}>
                  {hasForecast ? formatValue(Math.max(0, vatToPayForecast)) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div className={cn(
                  "flex-1 px-3 py-1.5 text-right border-r border-border/50",
                  vatToPayActual > 0 ? "text-muted-foreground" : vatToPayActual < 0 ? "text-success" : "text-muted-foreground"
                )}>
                  {hasActual ? formatValue(Math.max(0, vatToPayActual)) : '—'}
                </div>
                <div className={cn(
                  "flex-1 px-3 py-1.5 text-right",
                  vatToPayForecast > 0 ? "text-muted-foreground" : vatToPayForecast < 0 ? "text-success" : "text-muted-foreground"
                )}>
                  {hasForecast ? formatValue(Math.max(0, vatToPayForecast)) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  // Render opening balance row (solde au 1er du mois)
  const renderOpeningBalanceRow = () => {
    return (
      <tr className="font-semibold bg-primary/5 border-b-2 border-primary/30">
        <td className="p-3 sticky left-0 z-10 bg-primary/5 border-r border-border text-primary">
          Solde de début de mois
        </td>
        {months.map((month, monthIndex) => {
          const { balance, isActual } = getOpeningBalance(month);
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right font-bold",
                  balance >= 0 ? "text-primary" : "text-foreground"
                )}>
                  {formatValue(balance)}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right font-bold italic",
                  balance >= 0 ? "text-muted-foreground" : "text-foreground"
                )}>
                  {formatValue(balance)}
                </div>
              </td>
            );
          }
          
          // Current month: show actual balance only, forecast column shows "—"
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div className={cn(
                  "flex-1 px-3 py-2 text-right border-r border-border/50 font-bold",
                  balance >= 0 ? "text-primary" : "text-foreground"
                )}>
                  {formatValue(balance)}
                </div>
                <div className="flex-1 px-3 py-2 text-right text-muted-foreground">
                  —
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  // Render uncategorized payables row (only shown if there are uncategorized payables)
  const renderPayablesRow = () => {
    // Check if there are any uncategorized payables across all months
    const hasUncategorizedPayables = months.some(month => 
      getPayableOutflowUncategorized(month) > 0
    );
    
    if (!hasUncategorizedPayables) return null;
    
    return (
      <tr className="font-semibold bg-amber-500/10">
        <td className="p-3 sticky left-0 z-10 bg-amber-500/10 border-r border-border text-amber-700 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Dettes non catégorisées
          </div>
        </td>
        {months.map((month, monthIndex) => {
          const payableAmount = getPayableOutflowUncategorized(month);
          const hasAmount = payableAmount > 0;
          const periodType = getMonthPeriodType(month);
          
          // Payables only show forecast, not actual
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className="px-3 py-2 text-right text-muted-foreground">
                  —
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right",
                  hasAmount ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground"
                )}>
                  {hasAmount ? formatValue(payableAmount) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div className="flex-1 px-3 py-2 text-right border-r border-border/50 text-muted-foreground">
                  —
                </div>
                <div className={cn(
                  "flex-1 px-3 py-2 text-right",
                  hasAmount ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground"
                )}>
                  {hasAmount ? formatValue(payableAmount) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  const renderNetRow = () => {
    return (
      <tr className="font-bold bg-card border-t-2 border-primary">
        <td className="p-3 sticky left-0 z-10 bg-card border-r border-border text-primary">
          Variation nette du mois
        </td>
        {months.map((month, monthIndex) => {
          // Actuals are already TTC
          const incomeActual = getMonthTotal('income', monthIndex, 'actual');
          const expenseActual = getMonthTotal('expense', monthIndex, 'actual');
          
          // Include uncategorized actual transactions so variation matches balance rows
          const uncatIncome = getUncategorized('income', months[monthIndex]);
          const uncatExpense = getUncategorized('expense', months[monthIndex]);
          
          // getMonthTotal returns displayed forecast amounts as entered
          const incomeForecastTtc = getMonthTotal('income', monthIndex, 'forecast');
          
          // Per-category max(forecast, payables) to avoid double-counting
          let expenseForecastTtcAdjusted = 0;
          expenseCategories.forEach(cat => {
            const forecastAmount = getForecast(cat.id, months[monthIndex]);
            const payable = getPayableOutflowByCategory(cat.id, months[monthIndex]);
            expenseForecastTtcAdjusted += Math.max(forecastAmount, payable);
          });
          // Add uncategorized payables
          expenseForecastTtcAdjusted += getPayableOutflowUncategorized(months[monthIndex]);
          
          // Add net VAT to pay (only for forecasts, not actuals)
          const netVatForecast = getNetVatForecast(months[monthIndex]);
          const vatForecastToDeduct = Math.max(0, netVatForecast);
          expenseForecastTtcAdjusted += vatForecastToDeduct;
          
          const incomeTtc = incomeActual + uncatIncome;
          const expenseTtc = expenseActual + uncatExpense;
          const expenseForecastTtc = expenseForecastTtcAdjusted;
          
          const netActual = incomeTtc - expenseTtc;
          const netForecast = incomeForecastTtc - expenseForecastTtc;
          
          const hasActual = incomeActual > 0 || expenseActual > 0 || uncatIncome > 0 || uncatExpense > 0;
          const hasForecast = incomeForecastTtc > 0 || expenseForecastTtcAdjusted > 0 || vatForecastToDeduct > 0;
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right font-bold",
                  netActual >= 0 ? "text-success" : "text-foreground"
                )}>
                  {hasActual ? formatValue(netActual) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right font-bold",
                  netForecast >= 0 ? "text-primary" : "text-foreground"
                )}>
                  {hasForecast ? formatValue(netForecast) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div className={cn(
                  "flex-1 px-3 py-2 text-right border-r border-border/50 font-bold",
                  netActual >= 0 ? "text-success" : "text-foreground"
                )}>
                  {hasActual ? formatValue(netActual) : '—'}
                </div>
                <div className={cn(
                  "flex-1 px-3 py-2 text-right font-bold",
                  netForecast >= 0 ? "text-primary" : "text-foreground"
                )}>
                  {hasForecast ? formatValue(netForecast) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  const renderClosingBalanceRow = () => {
    return (
      <tr className="font-semibold bg-primary/10 border-t-2 border-primary/30">
        <td className="p-3 sticky left-0 z-10 bg-primary/10 border-r border-border text-primary">
          Solde de fin de mois
        </td>
        {months.map((month, monthIndex) => {
          const closingData = getClosingBalance(month);
          const { balance } = closingData;
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right font-bold",
                  balance >= 0 ? "text-primary" : "text-foreground"
                )}>
                  {formatValue(balance)}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right font-bold italic",
                  balance >= 0 ? "text-muted-foreground" : "text-foreground"
                )}>
                  {formatValue(balance)}
                </div>
              </td>
            );
          }
          
          // Current month: show actual (left) and forecast (right)
          const forecastBal = closingData.forecastBalance != null 
            ? closingData.forecastBalance 
            : balance;
          return (
            <td key={monthIndex} className="p-0 border-x-2 border-primary/30 min-w-[160px]">
              <div className="flex">
                <div className={cn(
                  "flex-1 px-3 py-2 text-right border-r border-border/50 font-bold",
                  balance >= 0 ? "text-primary" : "text-foreground"
                )}>
                  {formatValue(balance)}
                </div>
                <div className={cn(
                  "flex-1 px-3 py-2 text-right font-bold italic",
                  forecastBal >= 0 ? "text-muted-foreground" : "text-foreground"
                )}>
                  {formatValue(forecastBal)}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  if (isInitialLoading || isCategoriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-card p-8 text-center">
        <p className="text-muted-foreground mb-2">Aucune catégorie créée</p>
        <p className="text-sm text-muted-foreground">
          Créez des catégories dans la page "Catégories" pour commencer à faire des prévisions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Chart */}
      <ForecastChart 
        months={months}
        getMonthTotal={getMonthTotal}
        getPayableOutflow={getPayableOutflow}
        getClosingBalance={getClosingBalance}
        getUncategorized={getUncategorized}
      />
      
      {/* Table */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
      >
      <div className="p-6 border-b border-border flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">Prévisions par catégorie</h3>
          <p className="text-sm text-muted-foreground">
            Cliquez sur une cellule "Prévu" pour modifier le montant (sans conversion HT/TTC)
          </p>
        </div>
        
        {/* Period Selector */}
        <PeriodSelector
          startMonth={months[0]}
          endMonth={months[months.length - 1]}
          onExtendBefore={extendBefore}
          onExtendAfter={extendAfter}
          onShrinkBefore={shrinkBefore}
          onShrinkAfter={shrinkAfter}
          onReset={resetPeriod}
          canShrinkBefore={monthsBefore > 0}
          canShrinkAfter={monthsAfter > 0}
        />
        
        {/* Show All Categories toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant={showAllCategories ? "default" : "ghost"}
              size="sm" 
              className="h-8 px-2"
              onClick={() => setShowAllCategories(!showAllCategories)}
            >
              {showAllCategories ? (
                <Eye className="w-4 h-4 mr-1" />
              ) : (
                <EyeOff className="w-4 h-4 mr-1" />
              )}
              <span className="text-xs">{showAllCategories ? 'Toutes' : 'Actives'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {showAllCategories 
              ? "Masquer les catégories sans montants" 
              : "Afficher toutes les catégories (même vides)"}
          </TooltipContent>
        </Tooltip>

        {/* Expand/Collapse All buttons */}
        {allGroupIds.length > 0 && (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={expandAll}
                  disabled={allExpanded}
                >
                  <ChevronsDownUp className="w-4 h-4 mr-1" />
                  <span className="text-xs">Déplier</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tout déplier</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={collapseAll}
                  disabled={allCollapsed}
                >
                  <ChevronsUpDown className="w-4 h-4 mr-1" />
                  <span className="text-xs">Replier</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tout replier</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-border bg-card">
              <th className="text-left p-3 font-semibold text-foreground sticky left-0 z-30 bg-card border-r border-border min-w-[200px]">
                Catégorie
              </th>
              {months.map((month, index) => {
                const periodType = getMonthPeriodType(month);
                const minWidth = periodType === 'current' ? 'min-w-[160px]' : 'min-w-[90px]';
                
                if (periodType === 'past') {
                  return (
                    <th key={index} className={cn("p-0 border-r border-border bg-card", minWidth)}>
                      <div className="text-center p-2 border-b border-border/50 font-semibold text-foreground capitalize">
                        {formatMonth(month)}
                      </div>
                      <div className="px-3 py-1.5 text-center text-xs text-muted-foreground font-medium">
                        Réel
                      </div>
                    </th>
                  );
                }
                
                if (periodType === 'future') {
                  return (
                    <th key={index} className={cn("p-0 border-r border-border bg-card", minWidth)}>
                      <div className="text-center p-2 border-b border-border/50 font-semibold text-foreground capitalize">
                        {formatMonth(month)}
                      </div>
                      <div className="px-3 py-1.5 text-center text-xs text-muted-foreground font-medium">
                        Prévu
                      </div>
                    </th>
                  );
                }
                
                // Current month: both columns - highlighted
                return (
                  <th key={index} className={cn("p-0 border-x-2 border-primary/30", minWidth)}>
                    <div className="text-center p-2 border-b border-border/50 font-bold text-primary capitalize bg-primary/10">
                      {formatMonth(month)}
                    </div>
                    <div className="flex text-xs bg-primary/5">
                      <div className="flex-1 px-3 py-1.5 text-center border-r border-border/50 text-primary font-semibold">
                        Réel
                      </div>
                      <div className="flex-1 px-3 py-1.5 text-center text-primary font-semibold">
                        Prévu
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance Row */}
            {renderOpeningBalanceRow()}
            
            {/* Income Section - Collapsible */}
            {renderSectionHeaderRow('Encaissements', 'income', 'income')}
            {!collapsedSections.has('income') && (
              <>
                {renderGroupedSection(incomeGroups, 'income', 0)}
                {renderUncategorizedRow('income')}
              </>
            )}

            {/* Expense Section - Collapsible */}
            {renderSectionHeaderRow('Décaissements', 'expense', 'expense')}
            {!collapsedSections.has('expense') && (
              <>
                {renderGroupedSection(expenseGroups, 'expense', incomeCategories.length)}
                {renderUncategorizedRow('expense')}
                {renderVatToPayRow()}
              </>
            )}

            {/* Uncategorized payables notification moved to Engagements sidebar badge */}

            {/* Net Row */}
            {renderNetRow()}

            {/* Closing Balance Row */}
            {renderClosingBalanceRow()}
          </tbody>
        </table>
      </div>
    </motion.div>

      {/* Edit Category Dialog */}
      {editingCategory && (
        <CategoryDialog
          category={editingCategory}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingCategory(null);
          }}
          onSave={async (data) => {
            await updateCategory(editingCategory.id, data);
            setEditDialogOpen(false);
            setEditingCategory(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie "{categoryToDelete?.name}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              {transactionCount > 0 ? (
                <>
                  <span className="font-semibold text-destructive">{transactionCount} transaction{transactionCount > 1 ? 's' : ''}</span> associée{transactionCount > 1 ? 's' : ''} à cette catégorie ne seront plus catégorisée{transactionCount > 1 ? 's' : ''}.
                </>
              ) : (
                "Aucune transaction n'est associée à cette catégorie."
              )}
              <br /><br />
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transaction Detail Dialog */}
      {transactionDetailData && (
        <TransactionDetailDialog
          open={transactionDetailOpen}
          onOpenChange={setTransactionDetailOpen}
          categoryId={transactionDetailData.categoryId}
          categoryName={transactionDetailData.categoryName}
          categoryColor={transactionDetailData.categoryColor}
          categoryType={transactionDetailData.categoryType}
          initialMonth={transactionDetailData.month}
          forecastAmount={transactionDetailData.forecast}
        />
      )}

      {/* Override confirmation dialog */}
      <AlertDialog open={!!pendingOverrideCell} onOpenChange={(open) => {
        if (!open) setPendingOverrideCell(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver le calcul automatique ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette cellule est calculée automatiquement (% du CA). En saisissant une valeur manuellement, le calcul auto sera désactivé pour cette cellule. Vous pourrez revenir au calcul auto via un clic droit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingOverrideCell) {
                setOverrideWarningShown(true);
                handleCellClick(pendingOverrideCell.categoryId, pendingOverrideCell.monthIndex, pendingOverrideCell.currentValue);
                setPendingOverrideCell(null);
              }
            }}>
              Continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
