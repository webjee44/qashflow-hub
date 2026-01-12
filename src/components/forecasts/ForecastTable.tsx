import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useForecasts } from '@/hooks/useForecasts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

export function ForecastTable() {
  const { categories, loading: categoriesLoading } = useCategories();
  const { months, getForecast, getActual, upsertForecast, isLoading: forecastsLoading } = useForecasts();
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
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
  };

  const handleSave = async (categoryId: string, monthIndex: number) => {
    const value = parseFloat(editValue) || 0;
    await upsertForecast.mutateAsync({
      categoryId,
      month: months[monthIndex],
      expectedAmount: value,
    });
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, categoryId: string, monthIndex: number) => {
    if (e.key === 'Enter') {
      handleSave(categoryId, monthIndex);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Calculate totals for a month
  const getMonthTotal = (type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => {
    const cats = type === 'income' ? incomeCategories : expenseCategories;
    return cats.reduce((sum, cat) => {
      const value = valueType === 'forecast' 
        ? getForecast(cat.id, months[monthIndex])
        : getActual(cat.id, months[monthIndex]);
      return sum + Math.abs(value);
    }, 0);
  };

  const renderCell = (categoryId: string, monthIndex: number, type: 'income' | 'expense') => {
    const cellKey = `${categoryId}-${monthIndex}`;
    const forecast = getForecast(categoryId, months[monthIndex]);
    const actual = getActual(categoryId, months[monthIndex]);
    const isEditing = editingCell === cellKey;
    const isCurrentOrPast = months[monthIndex] <= new Date();
    
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
          <div 
            className="flex-1 px-3 py-2 text-right cursor-pointer hover:bg-primary/5 transition-colors"
            onClick={() => !isEditing && handleCellClick(categoryId, monthIndex, forecast)}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleSave(categoryId, monthIndex)}
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

  const renderNetRow = () => {
    return (
      <tr className="font-bold bg-card border-t-2 border-primary">
        <td className="p-3 sticky left-0 z-10 bg-card border-r border-border text-primary">
          Solde Net
        </td>
        {months.map((_, monthIndex) => {
          const incomeActual = getMonthTotal('income', monthIndex, 'actual');
          const expenseActual = getMonthTotal('expense', monthIndex, 'actual');
          const incomeForecast = getMonthTotal('income', monthIndex, 'forecast');
          const expenseForecast = getMonthTotal('expense', monthIndex, 'forecast');
          
          const netActual = incomeActual - expenseActual;
          const netForecast = incomeForecast - expenseForecast;
          
          return (
            <td key={monthIndex} className="p-0 border-r border-border">
              <div className="flex">
                <div className={cn(
                  "flex-1 px-3 py-2 text-right border-r border-border/50 font-bold",
                  netActual >= 0 ? "text-success" : "text-destructive"
                )}>
                  {(incomeActual > 0 || expenseActual > 0) ? formatValue(netActual) : '—'}
                </div>
                <div className={cn(
                  "flex-1 px-3 py-2 text-right font-bold",
                  netForecast >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {(incomeForecast > 0 || expenseForecast > 0) ? formatValue(netForecast) : '—'}
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
        <p className="text-sm text-muted-foreground">Cliquez sur une cellule "Prévu" pour modifier les prévisions</p>
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
                📈 Encaissements
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
                  </div>
                </td>
                {months.map((_, monthIndex) => renderCell(category.id, monthIndex, 'income'))}
              </motion.tr>
            ))}
            {renderTotalRow('Total Encaissements', 'income')}

            {/* Expense Section */}
            <tr className="bg-destructive/5">
              <td colSpan={months.length + 1} className="p-2 font-semibold text-destructive border-b border-border">
                📉 Décaissements
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
                  </div>
                </td>
                {months.map((_, monthIndex) => renderCell(category.id, monthIndex, 'expense'))}
              </motion.tr>
            ))}
            {renderTotalRow('Total Décaissements', 'expense')}

            {/* Net Row */}
            {renderNetRow()}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
