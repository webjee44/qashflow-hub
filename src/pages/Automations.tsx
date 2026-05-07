import { PageHeader } from '@/components/layout/PageHeader';
import { AutomationRules } from '@/components/automations/AutomationRules';
import { AutomationStats } from '@/components/automations/AutomationStats';

export default function Automations() {
  return (
    <div className="space-y-6">
      <AutomationStats />
      <PageHeader
        title="Automatisations IA"
        subtitle="Configurez vos règles d'automatisation intelligentes"
      />
      <AutomationRules />
    </div>
  );
}
