import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBPSettings } from '@/hooks/useBPSettings';
import { Loader2, Save, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const MONTHS = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
];

const BP_DURATIONS = [
  { value: 2, label: '2 ans' },
  { value: 3, label: '3 ans' },
  { value: 5, label: '5 ans' },
];

export function BPSettingsCard() {
  const { settings, isLoading, updateSettings } = useBPSettings();
  const [bpStartDate, setBpStartDate] = useState('');
  const [bpYears, setBpYears] = useState(3);
  const [fiscalMonth, setFiscalMonth] = useState(1);
  const [fiscalDay, setFiscalDay] = useState(1);
  const [firstFyEnd, setFirstFyEnd] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setBpStartDate(settings.bp_start_date || format(new Date(), 'yyyy-MM-dd'));
      setBpYears(settings.bp_years || 3);
      setFiscalMonth(settings.fiscal_year_start_month || 1);
      setFiscalDay(settings.fiscal_year_start_day || 1);
      setFirstFyEnd(settings.first_fiscal_year_end_date || '');
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings.mutateAsync({
        bp_start_date: bpStartDate,
        bp_years: bpYears,
        fiscal_year_start_month: fiscalMonth,
        fiscal_year_start_day: fiscalDay,
        first_fiscal_year_end_date: firstFyEnd || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Compute Y1 duration in months for display feedback
  const y1Months = (() => {
    if (!bpStartDate || !firstFyEnd) return null;
    const start = new Date(bpStartDate);
    const end = new Date(firstFyEnd);
    if (end <= start) return null;
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
  })();

  // Generate days for selected month
  const getDaysInMonth = (month: number) => {
    const daysInMonth = new Date(2024, month, 0).getDate(); // Use leap year for Feb
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  // Format fiscal year period display
  const getFiscalYearDisplay = () => {
    const monthName = MONTHS.find(m => m.value === fiscalMonth)?.label || 'Janvier';
    const endMonth = fiscalMonth === 1 ? 12 : fiscalMonth - 1;
    const endMonthName = MONTHS.find(m => m.value === endMonth)?.label || 'Décembre';
    const endDay = fiscalDay === 1 ? getDaysInMonth(endMonth).length : fiscalDay - 1;
    
    return `${fiscalDay} ${monthName} au ${endDay} ${endMonthName}`;
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Paramètres du Business Plan
        </CardTitle>
        <CardDescription>
          Configurez les dates et la durée de votre prévisionnel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* BP Start Date */}
        <div className="space-y-2">
          <Label htmlFor="bp-start">Date de début du BP</Label>
          <Input
            id="bp-start"
            type="date"
            value={bpStartDate}
            onChange={(e) => setBpStartDate(e.target.value)}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            Date à partir de laquelle le business plan commence
          </p>
        </div>

        {/* BP Duration */}
        <div className="space-y-2">
          <Label>Durée du Business Plan</Label>
          <Select value={bpYears.toString()} onValueChange={(v) => setBpYears(Number(v))}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BP_DURATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value.toString()}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fiscal Year Start */}
        <div className="space-y-4">
          <Label>Début de l'exercice fiscal</Label>
          <div className="flex gap-4 items-start">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Jour</Label>
              <Select value={fiscalDay.toString()} onValueChange={(v) => setFiscalDay(Number(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getDaysInMonth(fiscalMonth).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mois</Label>
              <Select value={fiscalMonth.toString()} onValueChange={(v) => setFiscalMonth(Number(v))}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm">
              <span className="font-medium">Exercice fiscal : </span>
              {getFiscalYearDisplay()}
            </p>
          </div>
        </div>

        {/* Premier exercice fiscal long (optionnel) */}
        <div className="space-y-2">
          <Label htmlFor="first-fy-end">Date de clôture du 1er exercice (optionnel)</Label>
          <Input
            id="first-fy-end"
            type="date"
            value={firstFyEnd}
            onChange={(e) => setFirstFyEnd(e.target.value)}
            min={bpStartDate || undefined}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            Si renseigné, définit la fin du 1er exercice fiscal (premier exercice long, max 24 mois — légal France pour création).
            Sinon, exercice calendaire 12 mois par défaut.
          </p>
          {y1Months !== null && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Durée du 1er exercice : </span>
                {y1Months} mois
                {y1Months > 12 && <span className="ml-2 text-primary">(premier exercice long)</span>}
                {y1Months > 24 && <span className="ml-2 text-destructive">(dépasse la limite de 24 mois)</span>}
              </p>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={isSaving || (y1Months !== null && y1Months > 24)} className="gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}