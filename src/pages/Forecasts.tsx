import { Header } from '@/components/layout/Header';
import { ForecastTable } from '@/components/forecasts/ForecastTable';
import { BalanceChart } from '@/components/dashboard/BalanceChart';

export default function Forecasts() {
  return (
    <div className="space-y-8">
      <Header 
        title="Prévisions" 
        subtitle="Gérez vos projections de trésorerie mois par mois" 
      />
      <BalanceChart />
      <ForecastTable />
    </div>
  );
}
