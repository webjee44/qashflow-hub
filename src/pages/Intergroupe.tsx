import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
} from '@/features/intercompany/hooks/useIntercompanyData';
import {
  computeIntercompanyPositions,
  type IntercompanyLinkStatus,
} from '@/features/intercompany/engine/computeIntercompanyPositions';
import { PositionsMatrix } from '@/features/intercompany/components/PositionsMatrix';
import { PairDrillDown } from '@/features/intercompany/components/PairDrillDown';
import { SuggestionsQueue } from '@/features/intercompany/components/SuggestionsQueue';
import { AnomaliesList } from '@/features/intercompany/components/AnomaliesList';
import { formatEUR } from '@/features/intercompany/lib/format';

type PeriodKey = 'all' | '12m' | '6m' | '3m';

function periodFrom(key: PeriodKey): string | undefined {
  if (key === 'all') return undefined;
  const months = key === '12m' ? 12 : key === '6m' ? 6 : 3;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export default function Intergroupe() {
  const { companies } = useCompany();
  const linksQ = useIntercompanyLinks();
  const anomaliesQ = useIntercompanyAnomalies();

  const [includeSuggested, setIncludeSuggested] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('all');
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
    return computeIntercompanyPositions(
      links.map(l => ({
        company_out: l.company_out,
        company_in: l.company_in,
        amount: l.amount,
        status: l.status,
        matched_at: l.matched_at,
      })),
      { includeStatuses: statuses, from: periodFrom(period) },
    );
  }, [links, includeSuggested, period]);

  const suggestedCount = useMemo(
    () => links.filter(l => l.status === 'suggested').length,
    [links],
  );

  const isLoading = linksQ.isLoading;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Intergroupe"
        subtitle="Flux et positions entre les sociétés du groupe"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Volume brut sur la période</p>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">
                {formatEUR(aggregate.totalGross, { compact: true })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Liens inclus</p>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">{aggregate.totalLinks}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Suggestions à valider</p>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">{suggestedCount}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="matrice" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matrice">Matrice</TabsTrigger>
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

        <TabsContent value="matrice" className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="period" className="text-sm">Période</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                <SelectTrigger id="period" className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout</SelectItem>
                  <SelectItem value="12m">12 derniers mois</SelectItem>
                  <SelectItem value="6m">6 derniers mois</SelectItem>
                  <SelectItem value="3m">3 derniers mois</SelectItem>
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
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <PositionsMatrix
              positions={aggregate.net}
              companyName={companyName}
              onSelect={(pair) => {
                setSelectedPair(pair);
                setDrillOpen(true);
              }}
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
