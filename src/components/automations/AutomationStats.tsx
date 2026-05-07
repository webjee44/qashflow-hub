import { motion } from 'framer-motion';
import { Zap, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import { useAutomationRealStats } from '@/features/automations';

/**
 * PR3 — Real, honest stats. No more hardcoded `accuracy: 96` / `timeSaved: '12h'`.
 *
 * Displays:
 *  - Transactions automatisées (lifetime applied)
 *  - Stabilité 30j (1 - corrections - rollbacks) — "—" if no sample
 *  - Taux de conflit (runs avec skip_conflict)
 *  - Temps économisé (8s par transaction appliquée)
 */
export function AutomationStats() {
  const { currentCompany } = useCompany();
  const stats = useAutomationRealStats(currentCompany?.id);

  const formatRate = (r: number | null) =>
    r === null ? '—' : `${Math.round(r * 100)}%`;
  const formatHours = (h: number) =>
    h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      <StatCard
        icon={<Zap className="w-5 h-5 text-primary" />}
        bg="bg-primary/10"
        value={stats.loading ? '…' : String(stats.totalAutomated)}
        label="Transactions automatisées"
      />
      <StatCard
        icon={<ShieldCheck className="w-5 h-5 text-success" />}
        bg="bg-success/10"
        value={stats.loading ? '…' : formatRate(stats.stabilityRate30d)}
        label="Stabilité 30j"
        hint="non corrigé / non annulé"
      />
      <StatCard
        icon={<AlertTriangle className="w-5 h-5 text-warning" />}
        bg="bg-warning/10"
        value={stats.loading ? '…' : formatRate(stats.conflictRate)}
        label="Taux de conflit"
        hint="runs avec règles concurrentes"
      />
      <StatCard
        icon={<Clock className="w-5 h-5 text-accent" />}
        bg="bg-accent/10"
        value={stats.loading ? '…' : formatHours(stats.timeSavedHours)}
        label="Temps économisé"
        hint="8 s / transaction"
      />
    </motion.div>
  );
}

function StatCard({ icon, bg, value, label, hint }: {
  icon: React.ReactNode; bg: string; value: string; label: string; hint?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground truncate">{value}</p>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
