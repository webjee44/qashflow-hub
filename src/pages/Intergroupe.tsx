import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Landmark } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCompany } from '@/hooks/useCompany';
import {
  useIntercompanyLinks,
  useIntercompanyAnomalies,
  useRunIncrementalMatch,
} from '@/features/intercompany/hooks/useIntercompanyData';
import {
  computeIntercompanyPositions,
  resolvePeriodPreset,
  type IntercompanyLinkStatus,
  type PeriodPresetKey,
} from '@/features/intercompany/engine/computeIntercompanyPositions';
import { PositionsList } from '@/features/intercompany/components/PositionsList';
import { PerCompanyPositions } from '@/features/intercompany/components/PerCompanyPositions';
import { PairDrillDown } from '@/features/intercompany/components/PairDrillDown';
import { SuggestionsQueue } from '@/features/intercompany/components/SuggestionsQueue';
import { AnomaliesList } from '@/features/intercompany/components/AnomaliesList';
import { formatEUR } from '@/features/intercompany/lib/format';

const PERIOD_LABELS: Record<PeriodPresetKey, string> = {
  all: 'toutes périodes',
  y2026: '2026',
  y2025: '2025',
  '12m': '12 derniers mois',
};

export default function Intergroupe() {
  const { companies } = useCompany();
  const linksQ = useIntercompanyLinks();
  const anomaliesQ = useIntercompanyAnomalies();
  const runMatch = useRunIncrementalMatch();

  const [includeSuggested, setIncludeSuggested] = useState(false);
  const [period, setPeriod] = useState<PeriodPresetKey>('all');
  const [selectedPair, setSelectedPair] = useState<{ a: string; b: string } | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);

  const companyName = useMemo(() => {
    const map = new Map(companies.map(c => [c.id, c.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [companies]);

  const links = linksQ.data ?? [];
  const anomalies = anomaliesQ.data ?? [];

  const aggregate = useMemo(() => {
    const statuses: IntercompanyLinkStatus[] = includeSuggested
      ? ['auto_matched', 'confirmed', 'suggested']
      : ['auto_matched', 'confirmed'];
    const bounds = resolvePeriodPreset(period);
    return computeIntercompanyPositions(
      links.map(l => ({
        company_out: l.company_out,
        company_in: l.company_in,
        amount: l.amount,
        status: l.status,
        tx_date: l.tx_date,
      })),
      {
        includeStatuses: statuses,
        periodFrom: bounds.from,
        periodTo: bounds.to,
      },
    );
  }, [links, includeSuggested, period]);

  const suggestedCount = useMemo(
    () => links.filter(l => l.status === 'suggested').length,
    [links],
  );

  const isLoading = linksQ.isLoading;
  const periodLabel = PERIOD_LABELS[period];

  const handleSelectPair = (pair: { a: string; b: string }) => {
    setSelectedPair(pair);
    setDrillOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Intergroupe"
        subtitle="Positions de trésorerie (virements appariés). La facturation intragroupe non réglée n'est pas incluse."
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" />
              Total des positions ouvertes
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {formatEUR(aggregate.totalOpenPositions, { compact: true })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {aggregate.openPositions.length} paire{aggregate.openPositions.length > 1 ? 's' : ''} à régler
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              Plus gros créancier
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : aggregate.topCreditor ? (
              <>
                <p className="text-lg font-semibold mt-1 truncate">
                  {companyName(aggregate.topCreditor.company_id)}
                </p>
                <p className="text-sm text-emerald-600 tabular-nums">
                  +{formatEUR(aggregate.topCreditor.net, { compact: true })} net
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              Plus gros débiteur
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : aggregate.topDebtor ? (
              <>
                <p className="text-lg font-semibold mt-1 truncate">
                  {companyName(aggregate.topDebtor.company_id)}
                </p>
                <p className="text-sm text-destructive tabular-nums">
                  −{formatEUR(Math.abs(aggregate.topDebtor.net), { compact: true })} net
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="societes">Par société</TabsTrigger>
          <TabsTrigger value="suggestions">
            Suggestions
            {suggestedCount > 0 && (
              <Badge variant="secondary" className="ml-2">{suggestedCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            Anomalies
            {anomalies.length > 0 && (
              <Badge variant="secondary" className="ml-2">{anomalies.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Shared filter bar */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="period" className="text-sm">Période (variation)</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPresetKey)}>
              <SelectTrigger id="period" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout</SelectItem>
                <SelectItem value="y2026">2026</SelectItem>
                <SelectItem value="y2025">2025</SelectItem>
                <SelectItem value="12m">12 derniers mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="include-suggested"
              checked={includeSuggested}
              onCheckedChange={setIncludeSuggested}
            />
            <Label htmlFor="include-suggested" className="text-sm">
              Inclure les suggérés
            </Label>
          </div>
          <p className="text-xs text-muted-foreground ml-auto">
            Le solde est cumulé depuis le début. La période ne pilote que la variation et le drill-down.
          </p>
        </div>

        <TabsContent value="positions" className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <PositionsList
              positions={aggregate.positions}
              companyName={companyName}
              onSelect={handleSelectPair}
              periodLabel={periodLabel}
            />
          )}
        </TabsContent>

        <TabsContent value="societes" className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <PerCompanyPositions
              perCompany={aggregate.perCompany}
              companyName={companyName}
              periodLabel={periodLabel}
              onSelectPair={handleSelectPair}
            />
          )}
        </TabsContent>

        <TabsContent value="suggestions">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <SuggestionsQueue links={links} companyName={companyName} />
          )}
        </TabsContent>

        <TabsContent value="anomalies">
          {anomaliesQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <AnomaliesList
              anomalies={anomalies}
              companyName={companyName}
              companyNames={companies.map(c => c.name)}
            />
          )}
        </TabsContent>
      </Tabs>

      <PairDrillDown
        open={drillOpen}
        onOpenChange={setDrillOpen}
        pair={selectedPair}
        links={links}
        companyName={companyName}
      />
    </div>
  );
}
