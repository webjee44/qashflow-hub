import { motion } from 'framer-motion';
import { Wallet, LineChart } from 'lucide-react';
import { useAppMode } from '@/hooks/useAppMode';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function ModeToggle() {
  const { mode, setMode, isBusinessPlan } = useAppMode();
  const navigate = useNavigate();

  const handleModeChange = (newMode: 'treasury' | 'business-plan') => {
    if (mode === newMode) return;
    setMode(newMode);
    navigate(newMode === 'business-plan' ? '/bp' : '/previsions');
  };

  return (
    <div className="relative flex items-center p-1 rounded-full bg-muted/80 backdrop-blur-sm border border-border shadow-inner">
      {/* Animated background pill */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute h-[calc(100%-8px)] rounded-full bg-gradient-to-r from-primary to-primary/90 shadow-lg"
        style={{
          width: 'calc(50% - 4px)',
          left: isBusinessPlan ? 'calc(50% + 2px)' : '4px',
        }}
      />

      {/* Treasury button */}
      <button
        onClick={() => handleModeChange('treasury')}
        className={cn(
          "relative z-10 flex items-center gap-2 px-4 py-2 rounded-full transition-colors duration-200",
          !isBusinessPlan 
            ? "text-primary-foreground font-medium" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Wallet className="h-4 w-4" />
        <span className="text-sm font-medium">Trésorerie</span>
      </button>

      {/* Business Plan button */}
      <button
        onClick={() => handleModeChange('business-plan')}
        className={cn(
          "relative z-10 flex items-center gap-2 px-4 py-2 rounded-full transition-colors duration-200",
          isBusinessPlan 
            ? "text-primary-foreground font-medium" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LineChart className="h-4 w-4" />
        <span className="text-sm font-medium">Prévisions</span>
      </button>
    </div>
  );
}
