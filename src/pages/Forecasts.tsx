import { Header } from '@/components/layout/Header';
import { ForecastTable } from '@/components/forecasts/ForecastTable';

export default function Forecasts() {
  return (
    <div className="space-y-8">
      <Header 
        title="Prévisions" 
        subtitle="Gérez vos projections de trésorerie par catégorie et par mois" 
      />
      <ForecastTable />
    </div>
  );
}
