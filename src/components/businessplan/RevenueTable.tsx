import { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, addMonths, startOfMonth, setMonth, setDate, setYear, getYear, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2, Edit, TrendingUp, Info } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  };

  const handleSave = async () => {
    if (!editingCell) return;

    const amount = parseFloat(inputValue) || 0;
    await upsertForecast.mutateAsync({
      streamId: editingCell.streamId,
      month: year1Months[editingCell.monthIndex],
      amount,
    });

    setEditingCell(null);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
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
                <TableHead key={i} className="text-center min-w-[90px]">
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
              const annualGrowth = (stream.annual_growth_rate ?? 0.10) * 100;
              
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
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            +{annualGrowth.toFixed(0)}%/an
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {/* Year 1 monthly cells - editable */}
                  {year1Months.map((month, monthIndex) => {
                    const value = getForecast(stream.id, month);
                    const isEditing = editingCell?.streamId === stream.id && editingCell?.monthIndex === monthIndex;

                    return (
                      <TableCell key={monthIndex} className="text-center p-1">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full h-8 text-center text-sm"
                          />
                        ) : (
                          <button
                            onClick={() => handleCellClick(stream.id, monthIndex, value)}
                            className={cn(
                              "w-full h-8 px-2 rounded text-sm transition-colors",
                              value > 0 
                                ? "bg-success/10 text-success hover:bg-success/20" 
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {value > 0 ? formatCurrency(value) : '-'}
                          </button>
                        )}
                      </TableCell>
                    );
                  })}
                  {/* Yearly summary cells */}
                  {fiscalYears.map((_, yearIndex) => {
                    const yearlyValue = getYearlyRevenue(stream.id, yearIndex, year1Months);
                    const isProjected = yearIndex > 0;
                    
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
                              <p>Année {yearIndex}: +{annualGrowth.toFixed(0)}% vs année précédente</p>
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