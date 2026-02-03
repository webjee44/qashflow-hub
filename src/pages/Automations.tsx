import { PageHeader } from '@/components/layout/PageHeader';
import { AutomationRules } from '@/components/automations/AutomationRules';
import { AutomationStats } from '@/components/automations/AutomationStats';
import { useAutomationRules } from '@/hooks/useAutomationRules';

export default function Automations() {
  const { stats } = useAutomationRules();

  return (
    <div className="space-y-6">
      {/* Stats en haut de page */}
      <AutomationStats
        totalAutomated={stats.totalAutomated}
        accuracy={stats.accuracy}
        timeSaved={stats.timeSaved}
      />

      <PageHeader 
        title="Automatisations IA" 
        subtitle="Configurez vos règles d'automatisation intelligentes" 
      />

      <AutomationRules />
    </div>
  );
}
