import { motion } from 'framer-motion';
import { Wallet, TrendingUp } from 'lucide-react';
import { useAppMode } from '@/hooks/useAppMode';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function ModeToggle() {
  const { mode, setMode } = useAppMode();
  const navigate = useNavigate();

  const handleModeChange = (newMode: 'treasury' | 'business-plan') => {
    if (newMode !== mode) {
      setMode(newMode);
      navigate(newMode === 'business-plan' ? '/bp' : '/previsions');
    }
  };

  return (
    <div className="relative flex items-center p-1 rounded-xl bg-muted/80 border border-border/50">
      {/* Animated background pill */}
      <motion.div
        className="absolute inset-y-1 rounded-lg bg-background shadow-sm border border-border/50"
        initial={false}
        animate={{
          left: mode === 'treasury' ? 4 : '50%',
          right: mode === 'treasury' ? '50%' : 4,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />

      {/* Treasury button */}
      <button
        onClick={() => handleModeChange('treasury')}
        className={cn(
          "relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          mode === 'treasury' 
            ? "text-foreground" 
            : "text-muted-foreground hover:text-foreground/80"
        )}
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">Trésorerie</span>
      </button>

      {/* Business Plan button */}
      <button
        onClick={() => handleModeChange('business-plan')}
        className={cn(
          "relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          mode === 'business-plan' 
            ? "text-foreground" 
            : "text-muted-foreground hover:text-foreground/80"
        )}
      >
        <TrendingUp className="h-4 w-4" />
        <span className="hidden sm:inline">Prévisions</span>
      </button>
    </div>
  );
}
