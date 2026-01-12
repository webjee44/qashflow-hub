import { motion } from 'framer-motion';
import { RefreshCw, FileSpreadsheet, Zap, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  {
    icon: RefreshCw,
    label: 'Synchroniser',
    description: 'Pennylane',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: FileSpreadsheet,
    label: 'Exporter',
    description: 'Rapport Excel',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    icon: Zap,
    label: 'Automatiser',
    description: 'Nouvelle règle',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    icon: Download,
    label: 'Télécharger',
    description: 'Prévisions PDF',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
  },
];

export function QuickActions() {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="bg-card rounded-2xl border border-border shadow-card p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">Actions rapides</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <motion.button
            key={action.label}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 + index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all duration-200 text-left group"
          >
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110",
              action.bgColor
            )}>
              <action.icon className={cn("w-5 h-5", action.color)} />
            </div>
            <p className="font-medium text-foreground">{action.label}</p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
