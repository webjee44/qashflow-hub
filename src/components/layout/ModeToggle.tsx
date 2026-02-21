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
    <div className="relative flex items-center gap-0.5 p-1 rounded-full bg-muted/60 backdrop-blur-sm border border-border/30 shadow-sm">
      {/* Animated background pill */}
      <motion.div
        className="absolute inset-y-1 rounded-full bg-primary shadow-md"
        initial={false}
        animate={{
          left: mode === 'treasury' ? 4 : '50%',
          right: mode === 'treasury' ? '50%' : 4,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />

      {/* Treasury button */}
      <button
        onClick={() => handleModeChange('treasury')}
        className={cn(
          "relative z-10 flex items-center gap-2 px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200",
          mode === 'treasury' 
            ? "text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">Trésorerie</span>
      </button>

      {/* Business Plan button */}
      <button
        onClick={() => handleModeChange('business-plan')}
        className={cn(
          "relative z-10 flex items-center gap-2 px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200",
          mode === 'business-plan' 
            ? "text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <TrendingUp className="h-4 w-4" />
        <span className="hidden sm:inline">Business Plan</span>
      </button>
    </div>
  );
}
