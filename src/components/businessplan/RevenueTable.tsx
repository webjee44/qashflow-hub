import { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, addMonths, startOfMonth, setMonth, setDate, setYear, getYear, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2, Edit, TrendingUp, Info, Copy, Check } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRevenueStreams, RevenueStream } from '@/hooks/useRevenueStreams';
import { useBPSettings } from '@/hooks/useBPSettings';
import { cn } from '@/lib/utils';

interface RevenueTableProps {
  onEditStream: (stream: RevenueStream) => void;
}

export function RevenueTable({ onEditStream }: RevenueTableProps) {
  const { streams, getForecast, upsertForecast, deleteStream, updateStream, getYearlyRevenue, getTotalYearlyRevenue, isLoading } = useRevenueStreams();
  const { settings } = useBPSettings();
  const [editingCell, setEditingCell] = useState<{ streamId: string; monthIndex: number } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Copy option states
  const [showCopyOption, setShowCopyOption] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ streamId: string; monthIndex: number; value: number } | null>(null);
  const [growthPercent, setGrowthPercent] = useState<string>('5');
  const [showGrowthInput, setShowGrowthInput] = useState(false);

  // Calculate fiscal years based on settings
  const fiscalYears = useMemo(() => {
    const bpStartDate = settings?.bp_start_date ? parseISO(settings.bp_start_date) : new Date();
    const bpYears = settings?.bp_years || 3;
    const fiscalStartMonth = (settings?.fiscal_year_start_month || 1) - 1; // Convert to 0-indexed
    const fiscalStartDay = settings?.fiscal_year_start_day || 1;

    const years: { label: string; startDate: Date; endDate: Date; months: Date[] }[] = [];
    
    let currentStart = setDate(setMonth(bpStartDate, fiscalStartMonth), fiscalStartDay);
    if (currentStart > bpStartDate) {
      currentStart = setYear(currentStart, getYear(currentStart) - 1);
    }

    for (let i = 0; i < bpYears; i++) {
      const yearStart = i === 0 ? bpStartDate : addMonths(currentStart, 12 * i);
      const yearEnd = addMonths(setDate(setMonth(yearStart, fiscalStartMonth), fiscalStartDay), 12);
      
      const months: Date[] = [];
      let monthCursor = startOfMonth(yearStart);
      while (monthCursor < yearEnd) {
        months.push(monthCursor);
        monthCursor = addMonths(monthCursor, 1);
      }
      
      const startYear = getYear(yearStart);
      const endYear = getYear(yearEnd);
      const label = startYear === endYear ? `Année ${i + 1} (${startYear})` : `Année ${i + 1} (${startYear}-${endYear})`;
      
      years.push({
        label,
        startDate: yearStart,
        endDate: yearEnd,
        months: months.slice(0, 12), // Cap at 12 months
      });
    }

    return years;
  }, [settings]);

  // Year 1 months for calculations
  const year1Months = fiscalYears[0]?.months || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleCellClick = (streamId: string, monthIndex: number, currentValue: number) => {
    setEditingCell({ streamId, monthIndex });
    setInputValue(currentValue === 0 ? '' : currentValue.toString());
    setShowCopyOption(false);
    setPendingSave(null);
  };

  const handleSave = async (mode: 'single' | 'copy' | 'growth' = 'single') => {
    const target = pendingSave || (editingCell ? { ...editingCell, value: parseFloat(inputValue) || 0 } : null);
    if (!target) return;

    const { streamId, monthIndex, value } = target;
    const amount = pendingSave ? value : (parseFloat(inputValue) || 0);

    if (mode === 'copy') {
      // Save same value for all remaining months of the year
      const promises = [];
      for (let i = monthIndex; i < year1Months.length; i++) {
        promises.push(upsertForecast.mutateAsync({
          streamId,
          month: year1Months[i],
          amount,
        }));
      }
      await Promise.all(promises);
    } else if (mode === 'growth') {
      // Save with progressive growth
      const growth = parseFloat(growthPercent) || 0;
      let currentValue = amount;
      const promises = [];
      for (let i = monthIndex; i < year1Months.length; i++) {
        promises.push(upsertForecast.mutateAsync({
          streamId,
          month: year1Months[i],
          amount: Math.round(currentValue),
        }));
        currentValue = currentValue * (1 + growth / 100);
      }
      await Promise.all(promises);
    } else {
      // Single save
      await upsertForecast.mutateAsync({
        streamId,
        month: year1Months[monthIndex],
        amount,
      });
    }

    // Reset states
    setEditingCell(null);
    setPendingSave(null);
    setShowCopyOption(false);
    setShowGrowthInput(false);
    setInputValue('');
    setGrowthPercent('5');
  };

  const handleInputBlur = (streamId: string, monthIndex: number) => {
    const amount = parseFloat(inputValue) || 0;
    
    // Show popover only if there are remaining months after this one
    if (monthIndex < year1Months.length - 1 && amount > 0) {
      setPendingSave({ streamId, monthIndex, value: amount });
      setShowCopyOption(true);
      setShowGrowthInput(false);
    } else {
      handleSave('single');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, streamId: string, monthIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const amount = parseFloat(inputValue) || 0;
      if (monthIndex < year1Months.length - 1 && amount > 0) {
        setPendingSave({ streamId, monthIndex, value: amount });
        setShowCopyOption(true);
        setShowGrowthInput(false);
      } else {
        handleSave('single');
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setPendingSave(null);
      setShowCopyOption(false);
      setInputValue('');
    }
  };

  // Inline name editing
  const handleNameDoubleClick = (stream: RevenueStream) => {
    setEditingName(stream.id);
    setNameValue(stream.name);
  };

  const handleNameSave = async (streamId: string) => {
    if (nameValue.trim() && nameValue !== streams.find(s => s.id === streamId)?.name) {
      await updateStream.mutateAsync({ id: streamId, name: nameValue.trim() });
    }
    setEditingName(null);
    setNameValue('');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent, streamId: string) => {
    if (e.key === 'Enter') {
      handleNameSave(streamId);
    } else if (e.key === 'Escape') {
      setEditingName(null);
      setNameValue('');
    }
  };

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const getMonthlyTotals = () => {
    return year1Months.map(month => 
      streams.reduce((sum, stream) => sum + getForecast(stream.id, month), 0)
    );
  };

  const monthlyTotals = getMonthlyTotals();
  const grandTotal = fiscalYears.reduce((sum, _, i) => sum + getTotalYearlyRevenue(i, year1Months), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (streams.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Flux de revenus</TableHead>
              {/* Year 1 monthly columns */}
              {year1Months.map((month, i) => (
                <TableHead key={i} className="text-center min-w-[110px]">
                  {format(month, 'MMM yy', { locale: fr })}
                </TableHead>
              ))}
              {/* Yearly summary columns */}
              {fiscalYears.map((year, i) => (
                <TableHead 
                  key={`year-${i}`} 
                  className={cn(
                    "text-center min-w-[120px]",
                    i === 0 ? "bg-muted/50" : "bg-primary/5"
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{year.label}</span>
                    {i > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        calculé
                      </Badge>
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {streams.map((stream) => {
              // Year-specific growth rates (only 2 rates for 3-year BP)
              const growthRates = [
                (stream.growth_rate_year2 ?? stream.annual_growth_rate ?? 0.10) * 100,
                (stream.growth_rate_year3 ?? stream.annual_growth_rate ?? 0.10) * 100,
              ];
              
              return (
                <TableRow key={stream.id} className="group">
                  <TableCell className="sticky left-0 bg-background z-10">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: stream.color }}
                      />
                      {editingName === stream.id ? (
                        <Input
                          ref={nameInputRef}
                          value={nameValue}
                          onChange={(e) => setNameValue(e.target.value)}
                          onBlur={() => handleNameSave(stream.id)}
                          onKeyDown={(e) => handleNameKeyDown(e, stream.id)}
                          className="h-7 w-full max-w-[150px] text-sm font-medium"
                        />
                      ) : (
                        <div className="flex flex-col">
                          <span 
                            className="font-medium cursor-pointer hover:text-primary transition-colors"
                            onDoubleClick={() => handleNameDoubleClick(stream)}
                            title="Double-cliquez pour renommer"
                          >
                            {stream.name}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-help">
                                <TrendingUp className="h-3 w-3" />
                                N+1: +{growthRates[0].toFixed(0)}% | N+2: +{growthRates[1].toFixed(0)}%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <div className="text-xs space-y-1">
                                <p>N+1 (Année 2): <strong>+{growthRates[0].toFixed(0)}%</strong> vs Année 1</p>
                                <p>N+2 (Année 3): <strong>+{growthRates[1].toFixed(0)}%</strong> vs Année 2</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {/* Year 1 monthly cells - editable */}
                  {year1Months.map((month, monthIndex) => {
                    const value = getForecast(stream.id, month);
                    const isEditing = editingCell?.streamId === stream.id && editingCell?.monthIndex === monthIndex;
                    const showPopover = showCopyOption && pendingSave?.streamId === stream.id && pendingSave?.monthIndex === monthIndex;

                    return (
                      <TableCell key={monthIndex} className="text-center p-1">
                        <Popover 
                          open={showPopover}
                          onOpenChange={(open) => {
                            if (!open && showPopover) {
                              handleSave('single');
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <div 
                              className={cn(
                                "w-full h-8 px-2 rounded text-sm transition-colors flex items-center justify-center",
                                !isEditing && (value > 0 
                                  ? "bg-success/10 text-success hover:bg-success/20 cursor-pointer" 
                                  : "text-muted-foreground hover:bg-muted cursor-pointer")
                              )}
                              onClick={() => !isEditing && !showPopover && handleCellClick(stream.id, monthIndex, value)}
                            >
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={inputValue}
                                  onChange={(e) => setInputValue(e.target.value)}
                                  onBlur={() => handleInputBlur(stream.id, monthIndex)}
                                  onKeyDown={(e) => handleKeyDown(e, stream.id, monthIndex)}
                                  autoFocus
                                  className="w-full h-8 text-center text-sm min-w-[100px]"
                                />
                              ) : (
                                <span>{value > 0 ? formatCurrency(value) : '-'}</span>
                              )}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-2" side="bottom" align="center">
                            <div className="flex flex-col gap-1">
                              <div className="text-xs text-muted-foreground px-2 py-1 border-b mb-1">
                                Valeur: <strong>{formatCurrency(pendingSave?.value || 0)}</strong>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="justify-start gap-2" 
                                onClick={() => handleSave('single')}
                              >
                                <Check className="w-4 h-4" />
                                Ce mois uniquement
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="justify-start gap-2 text-primary" 
                                onClick={() => handleSave('copy')}
                              >
                                <Copy className="w-4 h-4" />
                                Copier sur les mois suivants ({year1Months.length - monthIndex - 1} mois)
                              </Button>
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
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded">
                                  <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
                                  <span className="text-sm">+</span>
                                  <Input
                                    type="number"
                                    value={growthPercent}
                                    onChange={(e) => setGrowthPercent(e.target.value)}
                                    className="w-16 h-7 text-center"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSave('growth');
                                      }
                                    }}
                                  />
                                  <span className="text-sm">% / mois</span>
                                  <Button size="sm" className="h-7 px-2" onClick={() => handleSave('growth')}>
                                    OK
                                  </Button>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    );
                  })}
                  {/* Yearly summary cells */}
                  {fiscalYears.map((_, yearIndex) => {
                    const yearlyValue = getYearlyRevenue(stream.id, yearIndex, year1Months);
                    const isProjected = yearIndex > 0;
                    const yearGrowthRate = yearIndex > 0 ? growthRates[yearIndex - 1] : 0;
                    
                    return (
                      <TableCell 
                        key={`year-${yearIndex}`} 
                        className={cn(
                          "text-center font-semibold",
                          yearIndex === 0 ? "bg-muted/50" : "bg-primary/5"
                        )}
                      >
                        {isProjected ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help flex items-center justify-center gap-1">
                                {formatCurrency(yearlyValue)}
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Année {yearIndex + 1}: +{yearGrowthRate.toFixed(0)}% vs année {yearIndex}</p>
                              <p className="text-xs text-muted-foreground">
                                Calculé automatiquement
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          formatCurrency(yearlyValue)
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEditStream(stream)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteStream.mutate(stream.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {/* Total row */}
            <TableRow className="bg-primary/5 font-bold">
              <TableCell className="sticky left-0 bg-primary/5 z-10">
                TOTAL CA
              </TableCell>
              {monthlyTotals.map((total, i) => (
                <TableCell key={i} className="text-center text-primary">
                  {formatCurrency(total)}
                </TableCell>
              ))}
              {fiscalYears.map((_, yearIndex) => (
                <TableCell 
                  key={`total-year-${yearIndex}`} 
                  className={cn(
                    "text-center text-primary",
                    yearIndex === 0 ? "bg-muted/50" : "bg-primary/10"
                  )}
                >
                  {formatCurrency(getTotalYearlyRevenue(yearIndex, year1Months))}
                </TableCell>
              ))}
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}