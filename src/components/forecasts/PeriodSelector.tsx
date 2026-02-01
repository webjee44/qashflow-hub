import { Minus, Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PeriodSelectorProps {
  startMonth: Date;
  endMonth: Date;
  onExtendBefore: () => void;
  onExtendAfter: () => void;
  onReset?: () => void;
}

export function PeriodSelector({ 
  startMonth, 
  endMonth, 
  onExtendBefore, 
  onExtendAfter,
}: PeriodSelectorProps) {
  const formatMonth = (date: Date) => {
    return format(date, 'MMM yyyy', { locale: fr });
  };

  return (
    <div className="inline-flex items-center border border-border rounded-lg bg-background">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-r-none border-r border-border hover:bg-muted"
        onClick={onExtendBefore}
      >
        <Minus className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-2 px-3 py-2 min-w-[160px] justify-center">
        <span className="text-sm font-medium capitalize">
          {formatMonth(startMonth)} - {formatMonth(endMonth)}
        </span>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-l-none border-l border-border hover:bg-muted"
        onClick={onExtendAfter}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
