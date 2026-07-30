import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, Landmark, Building2, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
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

const getAccountTypeLabel = (type: string | null) => {
  switch (type) {
    case 'checking': return 'Courant';
    case 'savings': return 'Épargne';
    case 'card': return 'Carte';
    case 'loan': return 'Prêt';
    default: return type || 'Compte';
  }
};

function AlertBadge({ alert }: { alert: CompanyAlert }) {
  const config = {
    critical: {
      icon: AlertCircle,
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
    warning: {
      icon: AlertTriangle,
      className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
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
  const hasBlockedBankConnection = company.accounts.some(account =>
    account.itemStatus === 'needs_action' || account.itemStatus === 'error' || account.itemStatus === 'deleted'
  );

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
          <div className="flex items-start justify-between mb-3">
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
                {hasBlockedBankConnection ? (
                  <Link
                    to="/parametres?tab=accounts"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-warning flex items-center gap-1 mt-0.5 underline underline-offset-2 hover:text-warning/80"
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Synchro bloquée — reconnecter la banque
                  </Link>
                ) : company.lastSyncAt ? (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <RefreshCw className="h-2.5 w-2.5" />
                    Sync {formatDistanceToNow(new Date(company.lastSyncAt), { addSuffix: true, locale: fr })}
                  </p>
                ) : null}
                {company.balanceRefreshedAt && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Solde arrêté au {format(new Date(company.balanceRefreshedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
            <p className={cn(
              'text-xl font-bold tracking-tight',
              company.totalBalance >= 0 ? 'text-foreground' : 'text-destructive'
            )}>
              {formatCurrency(company.totalBalance)}
            </p>
          </div>

          {/* Sub-accounts list */}
          {company.accounts.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {company.accounts.map((account, i) => {
                const isLow = account.balance > 0 && account.balance < 1000;
                const isNegative = account.balance < 0;
                const isBlocked = account.itemStatus === 'needs_action' || account.itemStatus === 'error' || account.itemStatus === 'deleted';
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                      isBlocked ? 'bg-warning/5' : isNegative ? 'bg-destructive/5' : isLow ? 'bg-amber-500/5' : 'bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isBlocked ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" /> : <Landmark className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isNegative ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-muted-foreground'
                      )} />}
                      <span className="truncate text-foreground">
                        {account.bankName || account.name || getAccountTypeLabel(account.accountType)}
                      </span>
                      {account.iban && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          •••{account.iban.slice(-4)}
                        </span>
                      )}
                      {isBlocked && (
                        <span className="text-xs text-warning shrink-0">
                          Reconnexion requise
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      'font-medium tabular-nums shrink-0 ml-2',
                      isNegative ? 'text-destructive' : isLow ? 'text-amber-600' : 'text-foreground'
                    )}>
                      {formatCurrency(account.balance)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

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
