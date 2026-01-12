import { Header } from '@/components/layout/Header';
import { AutomationRules } from '@/components/automations/AutomationRules';

export default function Automations() {
  return (
    <div className="space-y-8">
      <Header 
        title="Automatisations" 
        subtitle="Règles de catégorisation automatique par IA" 
      />
      <AutomationRules />
    </div>
  );
}
