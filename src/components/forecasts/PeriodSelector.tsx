import { Minus, Plus, Calendar, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PeriodSelectorProps {
  startMonth: Date;
  endMonth: Date;
  onExtendBefore: () => void;
  onExtendAfter: () => void;
  onShrinkBefore?: () => void;
  onShrinkAfter?: () => void;
  onReset?: () => void;
  canShrinkBefore?: boolean;
  canShrinkAfter?: boolean;
}

export function PeriodSelector({ 
  startMonth, 
  endMonth, 
  onExtendBefore, 
  onExtendAfter,
  onShrinkBefore,
  onShrinkAfter,
  onReset,
  canShrinkBefore = false,
  canShrinkAfter = false,
}: PeriodSelectorProps) {
  const formatMonth = (date: Date) => {
    return format(date, 'MMM yyyy', { locale: fr });
  };

  return (
    <div className="inline-flex items-center border border-border rounded-lg bg-background">
      {/* Extend before */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-r-none border-r border-border hover:bg-muted"
            onClick={onExtendBefore}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Ajouter un mois avant</TooltipContent>
      </Tooltip>

      {/* Shrink before */}
      {canShrinkBefore && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-7 rounded-none border-r border-border hover:bg-muted"
              onClick={onShrinkBefore}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Retirer un mois avant</TooltipContent>
        </Tooltip>
      )}
      
      <div className="flex items-center gap-2 px-3 py-2 min-w-[160px] justify-center">
        <span className="text-sm font-medium capitalize">
          {formatMonth(startMonth)} - {formatMonth(endMonth)}
        </span>
        {onReset && (canShrinkBefore || canShrinkAfter) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onReset}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Réinitialiser la période</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Shrink after */}
      {canShrinkAfter && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-7 rounded-none border-l border-border hover:bg-muted"
              onClick={onShrinkAfter}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Retirer un mois après</TooltipContent>
        </Tooltip>
      )}
      
      {/* Extend after */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-l-none border-l border-border hover:bg-muted"
            onClick={onExtendAfter}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Ajouter un mois après</TooltipContent>
      </Tooltip>
    </div>
  );
}
