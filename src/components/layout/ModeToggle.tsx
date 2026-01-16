import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingUp } from 'lucide-react';
import { useAppMode } from '@/hooks/useAppMode';
import { useNavigate } from 'react-router-dom';

export function ModeToggle() {
  const { setMode, isBusinessPlan } = useAppMode();
  const navigate = useNavigate();

  const handleToggle = () => {
    const newMode = isBusinessPlan ? 'treasury' : 'business-plan';
    setMode(newMode);
    navigate(newMode === 'business-plan' ? '/bp' : '/previsions');
  };

  return (
    <button
      onClick={handleToggle}
      className="group relative flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-br from-muted/60 to-muted/40 hover:from-muted/80 hover:to-muted/60 border border-border/50 hover:border-border transition-all duration-300 shadow-sm hover:shadow-md"
    >
      {/* Active indicator glow */}
      <motion.div
        className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      />

      {/* Left icon - Treasury */}
      <div className="relative z-10 flex items-center justify-center">
        <motion.div
          animate={{
            scale: !isBusinessPlan ? 1.1 : 0.9,
            opacity: !isBusinessPlan ? 1 : 0.4,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Wallet className="h-4 w-4 text-primary" />
        </motion.div>
      </div>

      {/* Toggle track */}
      <div className="relative w-12 h-6 rounded-full bg-muted-foreground/20 shadow-inner">
        {/* Animated thumb */}
        <motion.div
          className="absolute top-1 w-4 h-4 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg"
          animate={{
            left: isBusinessPlan ? 'calc(100% - 20px)' : '4px',
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        
        {/* Glow effect on thumb */}
        <motion.div
          className="absolute top-1 w-4 h-4 rounded-full bg-primary/30 blur-sm"
          animate={{
            left: isBusinessPlan ? 'calc(100% - 20px)' : '4px',
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>

      {/* Right icon - Prévisions */}
      <div className="relative z-10 flex items-center justify-center">
        <motion.div
          animate={{
            scale: isBusinessPlan ? 1.1 : 0.9,
            opacity: isBusinessPlan ? 1 : 0.4,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <TrendingUp className="h-4 w-4 text-primary" />
        </motion.div>
      </div>

      {/* Label with AnimatePresence for smooth text transition */}
      <div className="relative z-10 min-w-[72px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={isBusinessPlan ? 'bp' : 'treasury'}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="block text-sm font-medium text-foreground"
          >
            {isBusinessPlan ? 'Prévisions' : 'Trésorerie'}
          </motion.span>
        </AnimatePresence>
      </div>
    </button>
  );
}
