import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useForecasts } from '@/hooks/useForecasts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function ForecastTable() {
  const { categories, loading: categoriesLoading } = useCategories();
  const { 
    months, 
    getForecast, 
    getActual, 
    getVatForecast, 
    getVatActual, 
    upsertForecast, 
    isLoading: forecastsLoading 
  } = useForecasts();
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showCopyOption, setShowCopyOption] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ categoryId: string; monthIndex: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLoading = categoriesLoading || forecastsLoading;

  // Separate categories by type
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

  const handleSave = async (categoryId: string, monthIndex: number, copyToFollowing: boolean = false) => {
    const value = parseFloat(editValue) || 0;
    
    if (copyToFollowing) {
      // Save to current month and all following months
      const promises = [];
      for (let i = monthIndex; i < months.length; i++) {
        promises.push(upsertForecast.mutateAsync({
          categoryId,
          month: months[i],
          expectedAmount: value,
        }));
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
    
    setEditingCell(null);
    setShowCopyOption(false);
    setPendingSave(null);
  };

  const handleInputBlur = (categoryId: string, monthIndex: number) => {
    // Only show copy option if there are following months
    if (monthIndex < months.length - 1) {
      setPendingSave({ categoryId, monthIndex });
      setShowCopyOption(true);
    } else {
      handleSave(categoryId, monthIndex, false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, categoryId: string, monthIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (monthIndex < months.length - 1) {
        setPendingSave({ categoryId, monthIndex });
        setShowCopyOption(true);
      } else {
        handleSave(categoryId, monthIndex, false);
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setShowCopyOption(false);
      setPendingSave(null);
    }
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Calculate totals for a month (HT - before VAT)
  const getMonthTotal = (type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => {
    const cats = type === 'income' ? incomeCategories : expenseCategories;
    return cats.reduce((sum, cat) => {
      const value = valueType === 'forecast' 
        ? getForecast(cat.id, months[monthIndex])
        : getActual(cat.id, months[monthIndex]);
      return sum + Math.abs(value);
    }, 0);
  };

  // Get VAT for a month
  const getMonthVat = (type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => {
    return valueType === 'forecast'
      ? getVatForecast(type, months[monthIndex])
      : getVatActual(type, months[monthIndex]);
  };

  const renderCell = (categoryId: string, monthIndex: number, type: 'income' | 'expense') => {
    const cellKey = `${categoryId}-${monthIndex}`;
    const forecast = getForecast(categoryId, months[monthIndex]);
    const actual = getActual(categoryId, months[monthIndex]);
    const isEditing = editingCell === cellKey;
    const showingCopyForThis = showCopyOption && pendingSave?.categoryId === categoryId && pendingSave?.monthIndex === monthIndex;
    
    // Color logic: green if actual >= forecast (for income) or actual <= forecast (for expense)
    const hasActual = actual !== 0;
    const isPositive = type === 'income' 
      ? actual >= forecast 
      : Math.abs(actual) <= forecast;

    return (
      <td key={cellKey} className="p-0 border-r border-border">
        <div className="flex">
          {/* Actual */}
          <div className={cn(
            "flex-1 px-3 py-2 text-right border-r border-border/50 bg-muted/20",
            hasActual && (isPositive ? "text-success" : "text-destructive")
          )}>
            {hasActual ? formatValue(Math.abs(actual)) : '—'}
          </div>
          
          {/* Forecast (editable) */}
          <Popover open={showingCopyForThis} onOpenChange={(open) => {
            if (!open && showingCopyForThis) {
              // User clicked outside, save without copying
              handleSave(categoryId, monthIndex, false);
            }
          }}>
            <PopoverTrigger asChild>
              <div 
                className="flex-1 px-3 py-2 text-right cursor-pointer hover:bg-primary/5 transition-colors"
                onClick={() => !isEditing && !showingCopyForThis && handleCellClick(categoryId, monthIndex, forecast)}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleInputBlur(categoryId, monthIndex)}
                    onKeyDown={(e) => handleKeyDown(e, categoryId, monthIndex)}
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
            <PopoverContent className="w-auto p-2" side="bottom" align="end">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => handleSave(categoryId, monthIndex, false)}
                >
                  <Check className="w-4 h-4" />
                  Ce mois uniquement
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2 text-primary"
                  onClick={() => handleSave(categoryId, monthIndex, true)}
                >
                  <Copy className="w-4 h-4" />
                  Copier sur les mois suivants
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </td>
    );
  };

  const renderTotalRow = (label: string, type: 'income' | 'expense', variant: 'subtotal' | 'total' = 'subtotal') => {
    const bgClass = variant === 'total' ? 'bg-primary/10' : 'bg-muted/50';
    const textClass = type === 'income' ? 'text-success' : 'text-destructive';
    
    return (
      <tr className={cn("font-semibold", bgClass)}>
        <td className="p-3 sticky left-0 z-10 bg-inherit border-r border-border">
          {label}
        </td>
        {months.map((_, monthIndex) => {
          const forecastTotal = getMonthTotal(type, monthIndex, 'forecast');
          const actualTotal = getMonthTotal(type, monthIndex, 'actual');
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border">
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
        {months.map((_, monthIndex) => {
          const forecastVat = getMonthVat(type, monthIndex, 'forecast');
          const actualVat = getMonthVat(type, monthIndex, 'actual');
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border">
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
        {months.map((_, monthIndex) => {
          const forecastHt = getMonthTotal(type, monthIndex, 'forecast');
          const actualHt = getMonthTotal(type, monthIndex, 'actual');
          const forecastVat = getMonthVat(type, monthIndex, 'forecast');
          const actualVat = getMonthVat(type, monthIndex, 'actual');
          
          const forecastTtc = forecastHt + forecastVat;
          const actualTtc = actualHt + actualVat;
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border">
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

  const renderVatToPayRow = () => {
    return (
      <tr className="font-semibold bg-amber-500/10">
        <td className="p-3 sticky left-0 z-10 bg-amber-500/10 border-r border-border text-amber-700 dark:text-amber-400">
          💰 TVA à payer
        </td>
        {months.map((_, monthIndex) => {
          const incomeVatForecast = getMonthVat('income', monthIndex, 'forecast');
          const expenseVatForecast = getMonthVat('expense', monthIndex, 'forecast');
          const incomeVatActual = getMonthVat('income', monthIndex, 'actual');
          const expenseVatActual = getMonthVat('expense', monthIndex, 'actual');
          
          const vatToPayForecast = incomeVatForecast - expenseVatForecast;
          const vatToPayActual = incomeVatActual - expenseVatActual;
          
          const hasActual = incomeVatActual > 0 || expenseVatActual > 0;
          const hasForecast = incomeVatForecast > 0 || expenseVatForecast > 0;
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border">
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

  const renderNetRow = () => {
    return (
      <tr className="font-bold bg-card border-t-2 border-primary">
        <td className="p-3 sticky left-0 z-10 bg-card border-r border-border text-primary">
          Solde Net TTC
        </td>
        {months.map((_, monthIndex) => {
          const incomeHt = getMonthTotal('income', monthIndex, 'actual');
          const expenseHt = getMonthTotal('expense', monthIndex, 'actual');
          const incomeVat = getMonthVat('income', monthIndex, 'actual');
          const expenseVat = getMonthVat('expense', monthIndex, 'actual');
          
          const incomeForecastHt = getMonthTotal('income', monthIndex, 'forecast');
          const expenseForecastHt = getMonthTotal('expense', monthIndex, 'forecast');
          const incomeForecastVat = getMonthVat('income', monthIndex, 'forecast');
          const expenseForecastVat = getMonthVat('expense', monthIndex, 'forecast');
          
          const incomeTtc = incomeHt + incomeVat;
          const expenseTtc = expenseHt + expenseVat;
          const incomeForecastTtc = incomeForecastHt + incomeForecastVat;
          const expenseForecastTtc = expenseForecastHt + expenseForecastVat;
          
          const netActual = incomeTtc - expenseTtc;
          const netForecast = incomeForecastTtc - expenseForecastTtc;
          
          const hasActual = incomeHt > 0 || expenseHt > 0;
          const hasForecast = incomeForecastHt > 0 || expenseForecastHt > 0;
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border">
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
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
    >
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Prévisions par catégorie</h3>
        <p className="text-sm text-muted-foreground">
          Cliquez sur une cellule "Prévu" pour modifier • Les montants sont HT, la TVA est calculée automatiquement
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-semibold text-foreground sticky left-0 z-10 bg-muted/30 border-r border-border min-w-[200px]">
                Catégorie
              </th>
              {months.map((month, index) => (
                <th key={index} className="p-0 border-r border-border min-w-[160px]">
                  <div className="text-center p-2 border-b border-border/50 font-semibold text-foreground capitalize">
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
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Income Section */}
            <tr className="bg-success/5">
              <td colSpan={months.length + 1} className="p-2 font-semibold text-success border-b border-border">
                📈 Encaissements (HT)
              </td>
            </tr>
            {incomeCategories.map((category, index) => (
              <motion.tr
                key={category.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * index }}
                className="border-b border-border hover:bg-muted/20 transition-colors"
              >
                <td className="p-3 sticky left-0 z-10 bg-card border-r border-border">
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
                  </div>
                </td>
                {months.map((_, monthIndex) => renderCell(category.id, monthIndex, 'income'))}
              </motion.tr>
            ))}
            {renderTotalRow('Total Encaissements HT', 'income')}
            {renderVatRow('TVA collectée', 'income')}
            {renderTtcRow('Total Encaissements TTC', 'income')}

            {/* Expense Section */}
            <tr className="bg-destructive/5">
              <td colSpan={months.length + 1} className="p-2 font-semibold text-destructive border-b border-border">
                📉 Décaissements (HT)
              </td>
            </tr>
            {expenseCategories.map((category, index) => (
              <motion.tr
                key={category.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * (index + incomeCategories.length) }}
                className="border-b border-border hover:bg-muted/20 transition-colors"
              >
                <td className="p-3 sticky left-0 z-10 bg-card border-r border-border">
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
                  </div>
                </td>
                {months.map((_, monthIndex) => renderCell(category.id, monthIndex, 'expense'))}
              </motion.tr>
            ))}
            {renderTotalRow('Total Décaissements HT', 'expense')}
            {renderVatRow('TVA déductible', 'expense')}
            {renderTtcRow('Total Décaissements TTC', 'expense')}

            {/* VAT to Pay Row */}
            {renderVatToPayRow()}

            {/* Net Row */}
            {renderNetRow()}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}