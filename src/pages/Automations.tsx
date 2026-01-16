import { PageHeader } from '@/components/layout/PageHeader';
import { AutomationRules } from '@/components/automations/AutomationRules';

export default function Automations() {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Automatisations" 
        subtitle="Règles de catégorisation automatique par IA" 
      />
      <AutomationRules />
    </div>
  );
}
