import { useState } from 'react';
import { motion } from 'framer-motion';
import { format, addMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2, Edit, ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRevenueStreams, RevenueStream } from '@/hooks/useRevenueStreams';
import { cn } from '@/lib/utils';

interface RevenueTableProps {
  onEditStream: (stream: RevenueStream) => void;
}

export function RevenueTable({ onEditStream }: RevenueTableProps) {
  const { streams, getForecast, upsertForecast, deleteStream, isLoading } = useRevenueStreams();
  const [editingCell, setEditingCell] = useState<{ streamId: string; monthIndex: number } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [collapsedStreams, setCollapsedStreams] = useState<Set<string>>(new Set());

  // Generate months for the next 12 months
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(new Date()), i));

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
      month: months[editingCell.monthIndex],
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

  const toggleCollapse = (streamId: string) => {
    setCollapsedStreams(prev => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  };

  const getMonthlyTotals = () => {
    return months.map(month => 
      streams.reduce((sum, stream) => sum + getForecast(stream.id, month), 0)
    );
  };

  const getStreamTotal = (streamId: string) => {
    return months.reduce((sum, month) => sum + getForecast(streamId, month), 0);
  };

  const monthlyTotals = getMonthlyTotals();
  const grandTotal = monthlyTotals.reduce((a, b) => a + b, 0);

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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Flux de revenus</TableHead>
            {months.map((month, i) => (
              <TableHead key={i} className="text-center min-w-[100px]">
                {format(month, 'MMM yy', { locale: fr })}
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[120px] bg-muted/50">Total</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {streams.map((stream) => (
            <TableRow key={stream.id} className="group">
              <TableCell className="sticky left-0 bg-background z-10">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: stream.color }}
                  />
                  <span className="font-medium">{stream.name}</span>
                </div>
              </TableCell>
              {months.map((month, monthIndex) => {
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
              <TableCell className="text-center font-semibold bg-muted/50">
                {formatCurrency(getStreamTotal(stream.id))}
              </TableCell>
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
          ))}
          
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
            <TableCell className="text-center text-primary bg-primary/10">
              {formatCurrency(grandTotal)}
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
