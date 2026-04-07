import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, Landmark, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CompanyBalance, CompanyAlert } from '@/hooks/useGroupBalances';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

function AlertBadge({ alert }: { alert: CompanyAlert }) {
  const config = {
    critical: {
      icon: AlertCircle,
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
    warning: {
      icon: AlertTriangle,
      className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    },
    info: {
      icon: Info,
      className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
  }[alert.severity];

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1 text-xs font-normal', config.className)}>
      <Icon className="h-3 w-3" />
      {alert.message}
    </Badge>
  );
}

interface CompanyCardProps {
  company: CompanyBalance;
  index: number;
  onClick: () => void;
}

export function CompanyCard({ company, index, onClick }: CompanyCardProps) {
  const hasCritical = company.alerts.some(a => a.severity === 'critical');
  const hasWarning = company.alerts.some(a => a.severity === 'warning');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
        <Card
        onClick={onClick}
        className={cn(
          'cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border',
          hasCritical && 'border-destructive/30',
          hasWarning && !hasCritical && 'border-amber-500/30',
          !hasCritical && !hasWarning && 'border-border'
        )}
      >
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{company.companyName}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Landmark className="h-3 w-3" />
                  {company.accountCount} compte{company.accountCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Balance */}
          <div className="mb-3">
            <p className={cn(
              'text-2xl font-bold tracking-tight',
              company.totalBalance >= 0 ? 'text-foreground' : 'text-destructive'
            )}>
              {formatCurrency(company.totalBalance)}
            </p>
          </div>

          {/* Alerts */}
          {company.alerts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {company.alerts.map((alert, i) => (
                <AlertBadge key={i} alert={alert} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
