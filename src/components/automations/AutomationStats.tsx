import { motion } from 'framer-motion';
import { Zap, Sparkles, Play } from 'lucide-react';

interface AutomationStatsProps {
  totalAutomated: number;
  accuracy: number;
  timeSaved: string;
}

export function AutomationStats({ totalAutomated, accuracy, timeSaved }: AutomationStatsProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="grid grid-cols-3 gap-4"
    >
      <div className="bg-card rounded-xl border border-border p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalAutomated}</p>
            <p className="text-sm text-muted-foreground">Transactions automatisées</p>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{accuracy}%</p>
            <p className="text-sm text-muted-foreground">Précision IA</p>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <Play className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{timeSaved}</p>
            <p className="text-sm text-muted-foreground">Temps économisé / mois</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
