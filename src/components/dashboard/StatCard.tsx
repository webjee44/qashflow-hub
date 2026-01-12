import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    type: 'positive' | 'negative' | 'neutral';
  };
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  delay?: number;
}

export function StatCard({ title, value, change, icon: Icon, variant = 'default', delay = 0 }: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    primary: 'gradient-primary text-primary-foreground',
    success: 'bg-success/10 border-success/20',
    warning: 'bg-warning/10 border-warning/20',
  };

  const iconBgStyles = {
    default: 'bg-primary/10 text-primary',
    primary: 'bg-primary-foreground/20 text-primary-foreground',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, duration: 0.4 }}
      className={cn(
        "p-6 rounded-2xl border border-border shadow-card transition-all duration-300 hover:shadow-lg",
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className={cn(
            "text-sm font-medium",
            variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}>
            {title}
          </p>
          <p className={cn(
            "text-3xl font-bold tracking-tight",
            variant === 'primary' ? 'text-primary-foreground' : 'text-foreground'
          )}>
            {value}
          </p>
          {change && (
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "text-sm font-semibold px-2 py-0.5 rounded-full",
                change.type === 'positive' && 'bg-success/20 text-success',
                change.type === 'negative' && 'bg-destructive/20 text-destructive',
                change.type === 'neutral' && 'bg-muted text-muted-foreground'
              )}>
                {change.value}
              </span>
              <span className={cn(
                "text-xs",
                variant === 'primary' ? 'text-primary-foreground/60' : 'text-muted-foreground'
              )}>
                vs mois dernier
              </span>
            </div>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-xl",
          iconBgStyles[variant]
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </motion.div>
  );
}
