import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useCategories, CategoryGroup, Category } from '@/hooks/useCategories';
import { useForecasts } from '@/hooks/useForecasts';
import { format, startOfMonth, isBefore, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Copy, Check, TrendingUp, ChevronRight, ChevronDown, Link2, ChevronsUpDown, ChevronsDownUp, MoreHorizontal, Edit3, Trash2, Eye, EyeOff, ArrowUpRight } from 'lucide-react';
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

export function ForecastTable() {
  const { categories, loading: categoriesLoading, getGroupedCategories, updateCategory, deleteCategory } = useCategories();
  const { 
    months, 
    getForecast, 
    getForecastSource,
    getActual, 
    getVatForecast, 
    getVatActual,
    getUncategorized,
    getPayableOutflow,
    upsertForecast, 
    isLoading: forecastsLoading,
    extendBefore,
    extendAfter,
  } = useForecasts();
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

  // Show all categories toggle (including empty ones)
  const [showAllCategories, setShowAllCategories] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SHOW_ALL_CATEGORIES_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Persist show all categories state
  useEffect(() => {
    localStorage.setItem(SHOW_ALL_CATEGORIES_KEY, JSON.stringify(showAllCategories));
  }, [showAllCategories]);

  // Transaction detail dialog state
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [transactionDetailData, setTransactionDetailData] = useState<{
    categoryId: string;
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

  const isLoading = categoriesLoading || forecastsLoading;

  // Get grouped categories
  const incomeGroups = useMemo(() => getGroupedCategories('income'), [categories]);
  const expenseGroups = useMemo(() => getGroupedCategories('expense'), [categories]);

  // Get all group IDs for default collapsed state
  const allGroupIds = useMemo(() => 
    [...incomeGroups, ...expenseGroups]
      .filter(g => g.group)
      .map(g => g.group!.id),
    [incomeGroups, expenseGroups]
  );
  
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
  };

  const collapseAll = () => {
    setCollapsedGroups(new Set(allGroupIds));
  };

  const allCollapsed = allGroupIds.length > 0 && allGroupIds.every(id => collapsedGroups.has(id));
  const allExpanded = allGroupIds.length > 0 && !allGroupIds.some(id => collapsedGroups.has(id));

  // Separate categories by type (for backward compatibility)
  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

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
    const cellKey = `${categoryId}-${monthIndex}`;
    setEditingCell(cellKey);
    setEditValue(currentValue.toString());
    setShowCopyOption(false);
    setPendingSave(null);
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

  // Calculate totals for a month (HT - before VAT)
  const getMonthTotal = useCallback((type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => {
    const cats = type === 'income' ? incomeCategories : expenseCategories;
    return cats.reduce((sum, cat) => {
      const value = valueType === 'forecast' 
        ? getForecast(cat.id, months[monthIndex])
        : getActual(cat.id, months[monthIndex]);
      return sum + Math.abs(value);
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
    
    const periodType = getMonthPeriodType(months[monthIndex]);
    
    // Color logic: green if actual >= forecast (for income) or actual <= forecast (for expense)
    const hasActual = actual !== 0;
    const isPositive = type === 'income' 
      ? actual >= forecast 
      : Math.abs(actual) <= forecast;

    const isBpSource = source === 'bp_import' || source === 'bp_synced';

    // Past: only show actual
    if (periodType === 'past') {
      return (
        <td key={cellKey} className="p-0 border-r border-border min-w-[90px]">
          <div 
            className={cn(
              "px-3 py-2 text-right bg-muted/20 transition-colors",
              hasActual && (isPositive ? "text-success" : "text-destructive"),
              hasActual && "cursor-pointer hover:bg-muted/40"
            )}
            onClick={() => hasActual && openTransactionDetail(category, monthIndex)}
          >
            {hasActual ? formatValue(Math.abs(actual)) : '—'}
          </div>
        </td>
      );
    }

    // Future: only show forecast (editable)
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
                  isBpSource && "bg-primary/5"
                )}
                onClick={() => !isEditing && !showingCopyForThis && handleCellClick(categoryId, monthIndex, forecast)}
              >
                {isBpSource && forecast > 0 && !isEditing && (
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
                ) : (
                  <span className={cn(
                    "text-muted-foreground",
                    forecast > 0 && "text-foreground"
                  )}>
                    {forecast > 0 ? formatValue(forecast) : '—'}
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

    // Current: show both actual + forecast
    return (
      <td key={cellKey} className="p-0 border-r border-border min-w-[160px]">
        <div className="flex">
          {/* Actual - clickable to open detail */}
          <div 
            className={cn(
              "flex-1 px-3 py-2 text-right border-r border-border/50 bg-muted/20 transition-colors",
              hasActual && (isPositive ? "text-success" : "text-destructive"),
              hasActual && "cursor-pointer hover:bg-muted/40"
            )}
            onClick={() => hasActual && openTransactionDetail(category, monthIndex)}
          >
            {hasActual ? formatValue(Math.abs(actual)) : '—'}
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
                  isBpSource && "bg-primary/5"
                )}
                onClick={() => !isEditing && !showingCopyForThis && handleCellClick(categoryId, monthIndex, forecast)}
              >
                {isBpSource && forecast > 0 && !isEditing && (
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
                ) : (
                  <span className={cn(
                    "text-muted-foreground",
                    forecast > 0 && "text-foreground"
                  )}>
                    {forecast > 0 ? formatValue(forecast) : '—'}
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
      const value = valueType === 'forecast' 
        ? getForecast(cat.id, months[monthIndex])
        : getActual(cat.id, months[monthIndex]);
      return sum + Math.abs(value);
    }, 0);
  }, [getForecast, getActual, months]);

  const renderGroupRow = (group: CategoryGroup, type: 'income' | 'expense') => {
    if (!group.group) return null; // Don't render header for ungrouped categories
    
    const groupId = group.group.id;
    const isCollapsed = collapsedGroups.has(groupId);
    const textClass = type === 'income' ? 'text-success' : 'text-destructive';
    
    return (
      <tr 
        key={`group-${groupId}`}
        className="bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors border-t-2 border-b border-border"
        onClick={() => toggleGroup(groupId)}
      >
        <td className="p-3 sticky left-0 z-10 bg-muted/50 border-r border-border">
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
            <div 
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${group.group.color}25` }}
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: group.group.color }}
              />
            </div>
            <span className={cn("font-bold uppercase tracking-wide text-foreground", textClass)}>
              {group.group.name}
            </span>
            <span className="text-xs text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
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
              <td key={monthIndex} className="p-0 border-r border-border bg-muted/30 min-w-[90px]">
                <div className={cn("px-3 py-2 text-right font-semibold", textClass)}>
                  {actualTotal > 0 ? formatValue(actualTotal) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border bg-muted/30 min-w-[90px]">
                <div className={cn("px-3 py-2 text-right font-semibold", textClass)}>
                  {forecastTotal > 0 ? formatValue(forecastTotal) : '—'}
                </div>
              </td>
            );
          }
          
          // Current month: both
          return (
            <td key={monthIndex} className="p-0 border-r border-border bg-muted/30 min-w-[160px]">
              <div className="flex">
                <div className={cn("flex-1 px-3 py-2 text-right border-r border-border/50 font-semibold", textClass)}>
                  {actualTotal > 0 ? formatValue(actualTotal) : '—'}
                </div>
                <div className={cn("flex-1 px-3 py-2 text-right font-semibold", textClass)}>
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
        elements.push(
          <AnimatePresence key={`children-${groupId}`}>
            {visibleChildren.map((category) => {
              const row = renderCategoryRow(category, currentIndex, type, !!group.group);
              currentIndex++;
              return row;
            })}
          </AnimatePresence>
        );
      }
      
      return elements;
    });
  };

  const renderTotalRow = (label: string, type: 'income' | 'expense', variant: 'subtotal' | 'total' = 'subtotal') => {
    const bgClass = variant === 'total' ? 'bg-primary/10' : 'bg-muted/50';
    const textClass = type === 'income' ? 'text-success' : 'text-destructive';
    
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
            <td key={monthIndex} className="p-0 border-r border-border min-w-[160px]">
              <div className="flex">
                <div className={cn("flex-1 px-3 py-2 text-right border-r border-border/50", textClass)}>
                  {actualTotal > 0 ? formatValue(actualTotal) : '—'}
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
    const textClass = type === 'income' ? 'text-success/70' : 'text-destructive/70';
    
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
    const textClass = type === 'income' ? 'text-success' : 'text-destructive';
    
    return (
      <tr className="font-bold bg-muted/60">
        <td className={cn("p-3 sticky left-0 z-10 bg-muted/60 border-r border-border", textClass)}>
          {label}
        </td>
        {months.map((month, monthIndex) => {
          const forecastHt = getMonthTotal(type, monthIndex, 'forecast');
          const actualHt = getMonthTotal(type, monthIndex, 'actual');
          const forecastVat = getMonthVat(type, monthIndex, 'forecast');
          const actualVat = getMonthVat(type, monthIndex, 'actual');
          
          const forecastTtc = forecastHt + forecastVat;
          const actualTtc = actualHt + actualVat;
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
            <td key={monthIndex} className="p-0 border-r border-border min-w-[160px]">
              <div className="flex">
                <div className={cn("flex-1 px-3 py-2 text-right border-r border-border/50", textClass)}>
                  {actualTtc > 0 ? formatValue(actualTtc) : '—'}
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

  const renderUncategorizedRow = (type: 'income' | 'expense') => {
    const label = type === 'income' ? '⚠️ Non catégorisés (encaissements)' : '⚠️ Non catégorisés (décaissements)';
    
    // Check if there are any uncategorized transactions for this type
    const hasUncategorized = months.some(month => getUncategorized(type, month) > 0);
    if (!hasUncategorized) return null;
    
    return (
      <tr className="bg-amber-500/10 border-b border-border">
        <td className="p-3 sticky left-0 z-10 bg-amber-500/10 border-r border-border">
          <div className="flex items-center gap-2">
            <span className="font-medium text-amber-700 dark:text-amber-400">{label}</span>
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
                <div className={cn(
                  "px-3 py-2 text-right font-medium",
                  amount > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                )}>
                  {amount > 0 ? formatValue(amount) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border min-w-[160px]">
              <div className="flex">
                <div className={cn(
                  "flex-1 px-3 py-2 text-right border-r border-border/50 font-medium",
                  amount > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                )}>
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
      <tr className="font-semibold bg-amber-500/10">
        <td className="p-3 sticky left-0 z-10 bg-amber-500/10 border-r border-border text-amber-700 dark:text-amber-400">
          💰 TVA à payer
        </td>
        {months.map((month, monthIndex) => {
          const incomeVatForecast = getMonthVat('income', monthIndex, 'forecast');
          const expenseVatForecast = getMonthVat('expense', monthIndex, 'forecast');
          const incomeVatActual = getMonthVat('income', monthIndex, 'actual');
          const expenseVatActual = getMonthVat('expense', monthIndex, 'actual');
          
          const vatToPayForecast = incomeVatForecast - expenseVatForecast;
          const vatToPayActual = incomeVatActual - expenseVatActual;
          
          const hasActual = incomeVatActual > 0 || expenseVatActual > 0;
          const hasForecast = incomeVatForecast > 0 || expenseVatForecast > 0;
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right",
                  vatToPayActual >= 0 ? "text-amber-700 dark:text-amber-400" : "text-success"
                )}>
                  {hasActual ? formatValue(vatToPayActual) : '—'}
                </div>
              </td>
            );
          }
          
          if (periodType === 'future') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right",
                  vatToPayForecast >= 0 ? "text-amber-700 dark:text-amber-400" : "text-success"
                )}>
                  {hasForecast ? formatValue(vatToPayForecast) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border min-w-[160px]">
              <div className="flex">
                <div className={cn(
                  "flex-1 px-3 py-2 text-right border-r border-border/50",
                  vatToPayActual >= 0 ? "text-amber-700 dark:text-amber-400" : "text-success"
                )}>
                  {hasActual ? formatValue(vatToPayActual) : '—'}
                </div>
                <div className={cn(
                  "flex-1 px-3 py-2 text-right",
                  vatToPayForecast >= 0 ? "text-amber-700 dark:text-amber-400" : "text-success"
                )}>
                  {hasForecast ? formatValue(vatToPayForecast) : '—'}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  // Render payables row (supplier debts)
  const renderPayablesRow = () => {
    return (
      <tr className="font-semibold bg-destructive/10">
        <td className="p-3 sticky left-0 z-10 bg-destructive/10 border-r border-border text-destructive">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" />
            Dettes à payer
          </div>
        </td>
        {months.map((month, monthIndex) => {
          const payableAmount = getPayableOutflow(month);
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
                  hasAmount ? "text-destructive font-medium" : "text-muted-foreground"
                )}>
                  {hasAmount ? formatValue(payableAmount) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border min-w-[160px]">
              <div className="flex">
                <div className="flex-1 px-3 py-2 text-right border-r border-border/50 text-muted-foreground">
                  —
                </div>
                <div className={cn(
                  "flex-1 px-3 py-2 text-right",
                  hasAmount ? "text-destructive font-medium" : "text-muted-foreground"
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
          Solde Net TTC
        </td>
        {months.map((month, monthIndex) => {
          const incomeHt = getMonthTotal('income', monthIndex, 'actual');
          const expenseHt = getMonthTotal('expense', monthIndex, 'actual');
          const incomeVat = getMonthVat('income', monthIndex, 'actual');
          const expenseVat = getMonthVat('expense', monthIndex, 'actual');
          
          const incomeForecastHt = getMonthTotal('income', monthIndex, 'forecast');
          const expenseForecastHt = getMonthTotal('expense', monthIndex, 'forecast');
          const incomeForecastVat = getMonthVat('income', monthIndex, 'forecast');
          const expenseForecastVat = getMonthVat('expense', monthIndex, 'forecast');
          
          // Add payables to forecast expenses
          const payableAmount = getPayableOutflow(month);
          
          const incomeTtc = incomeHt + incomeVat;
          const expenseTtc = expenseHt + expenseVat;
          const incomeForecastTtc = incomeForecastHt + incomeForecastVat;
          const expenseForecastTtc = expenseForecastHt + expenseForecastVat + payableAmount;
          
          const netActual = incomeTtc - expenseTtc;
          const netForecast = incomeForecastTtc - expenseForecastTtc;
          
          const hasActual = incomeHt > 0 || expenseHt > 0;
          const hasForecast = incomeForecastHt > 0 || expenseForecastHt > 0 || payableAmount > 0;
          const periodType = getMonthPeriodType(month);
          
          if (periodType === 'past') {
            return (
              <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
                <div className={cn(
                  "px-3 py-2 text-right font-bold",
                  netActual >= 0 ? "text-success" : "text-destructive"
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
                  netForecast >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {hasForecast ? formatValue(netForecast) : '—'}
                </div>
              </td>
            );
          }
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border min-w-[160px]">
              <div className="flex">
                <div className={cn(
                  "flex-1 px-3 py-2 text-right border-r border-border/50 font-bold",
                  netActual >= 0 ? "text-success" : "text-destructive"
                )}>
                  {hasActual ? formatValue(netActual) : '—'}
                </div>
                <div className={cn(
                  "flex-1 px-3 py-2 text-right font-bold",
                  netForecast >= 0 ? "text-primary" : "text-destructive"
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

  if (isLoading) {
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
        getMonthVat={getMonthVat}
        getPayableOutflow={getPayableOutflow}
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
            Cliquez sur une cellule "Prévu" pour modifier • Les montants sont HT, la TVA est calculée automatiquement
          </p>
        </div>
        
        {/* Period Selector */}
        <PeriodSelector
          startMonth={months[0]}
          endMonth={months[months.length - 1]}
          onExtendBefore={extendBefore}
          onExtendAfter={extendAfter}
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-semibold text-foreground sticky left-0 z-10 bg-muted/30 border-r border-border min-w-[200px]">
                Catégorie
              </th>
              {months.map((month, index) => {
                const periodType = getMonthPeriodType(month);
                const minWidth = periodType === 'current' ? 'min-w-[160px]' : 'min-w-[90px]';
                
                if (periodType === 'past') {
                  return (
                    <th key={index} className={cn("p-0 border-r border-border", minWidth)}>
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
                    <th key={index} className={cn("p-0 border-r border-border", minWidth)}>
                      <div className="text-center p-2 border-b border-border/50 font-semibold text-foreground capitalize">
                        {formatMonth(month)}
                      </div>
                      <div className="px-3 py-1.5 text-center text-xs text-muted-foreground font-medium">
                        Prévu
                      </div>
                    </th>
                  );
                }
                
                // Current month: both columns
                return (
                  <th key={index} className={cn("p-0 border-r border-border", minWidth)}>
                    <div className="text-center p-2 border-b border-border/50 font-semibold text-foreground capitalize bg-primary/5">
                      {formatMonth(month)}
                    </div>
                    <div className="flex text-xs">
                      <div className="flex-1 px-3 py-1.5 text-center border-r border-border/50 text-muted-foreground font-medium">
                        Réel
                      </div>
                      <div className="flex-1 px-3 py-1.5 text-center text-muted-foreground font-medium">
                        Prévu
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Income Section */}
            <tr className="bg-success/5">
              <td colSpan={months.length + 1} className="p-2 font-semibold text-success border-b border-border">
                📈 Encaissements
              </td>
            </tr>
            {renderGroupedSection(incomeGroups, 'income', 0)}
            {renderUncategorizedRow('income')}
            {renderTtcRow('Total Encaissements', 'income')}

            {/* Expense Section */}
            <tr className="bg-destructive/5">
              <td colSpan={months.length + 1} className="p-2 font-semibold text-destructive border-b border-border">
                📉 Décaissements
              </td>
            </tr>
            {renderGroupedSection(expenseGroups, 'expense', incomeCategories.length)}
            {renderUncategorizedRow('expense')}
            {renderTtcRow('Total Décaissements', 'expense')}

            {/* Payables Row (supplier debts) */}
            {renderPayablesRow()}

            {/* VAT to Pay Row */}
            {renderVatToPayRow()}

            {/* Net Row */}
            {renderNetRow()}
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
    </div>
  );
}
