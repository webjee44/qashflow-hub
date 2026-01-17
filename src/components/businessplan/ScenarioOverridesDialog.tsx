import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Trash2, Percent, DollarSign, Ban } from 'lucide-react';
import { Scenario } from '@/hooks/useScenarios';
import { useScenarioOverrides, ItemType, OverrideType } from '@/hooks/useScenarioOverrides';
import { useBPRevenueStreams } from '@/hooks/useBPRevenueStreams';
import { useBPFixedExpenses } from '@/hooks/useBPFixedExpenses';
import { useBPPersonnel } from '@/hooks/useBPPersonnel';

interface ScenarioOverridesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: Scenario;
}

export function ScenarioOverridesDialog({ open, onOpenChange, scenario }: ScenarioOverridesDialogProps) {
  const { overrides, setOverride, removeOverride } = useScenarioOverrides(scenario.id);
  const { streams: revenueStreams } = useBPRevenueStreams();
  const { expenses: fixedExpenses } = useBPFixedExpenses();
  const { personnel } = useBPPersonnel();

  const [activeTab, setActiveTab] = useState<ItemType>('revenue_stream');

  const getOverrideForItem = (itemType: ItemType, itemId: string) => {
    return overrides.find(o => o.item_type === itemType && o.item_id === itemId);
  };

  const handleToggleOverride = (itemType: ItemType, itemId: string, enabled: boolean) => {
    if (enabled) {
      setOverride.mutate({
        scenarioId: scenario.id,
        itemType,
        itemId,
        overrideType: 'multiplier',
        overrideValue: 1,
      });
    } else {
      removeOverride.mutate({ scenarioId: scenario.id, itemType, itemId });
    }
  };

  const handleOverrideChange = (itemType: ItemType, itemId: string, type: OverrideType, value?: number) => {
    setOverride.mutate({
      scenarioId: scenario.id,
      itemType,
      itemId,
      overrideType: type,
      overrideValue: value,
    });
  };

  const OverrideRow = ({ 
    itemType, 
    itemId, 
    name, 
    originalValue 
  }: { 
    itemType: ItemType; 
    itemId: string; 
    name: string; 
    originalValue: number;
  }) => {
    const override = getOverrideForItem(itemType, itemId);
    const hasOverride = !!override;

    const formatCurrency = (v: number) => 
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

    const getAdjustedValue = () => {
      if (!override) return originalValue;
      switch (override.override_type) {
        case 'multiplier':
          return originalValue * (override.override_value || 1);
        case 'fixed_value':
          return override.override_value || 0;
        case 'disabled':
          return 0;
        default:
          return originalValue;
      }
    };

    return (
      <div className="flex items-center gap-3 py-3 border-b border-border/50">
        <Switch 
          checked={hasOverride} 
          onCheckedChange={(checked) => handleToggleOverride(itemType, itemId, checked)}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">
            Base: {formatCurrency(originalValue)}/mois
            {hasOverride && (
              <span className="ml-2 text-primary">→ {formatCurrency(getAdjustedValue())}/mois</span>
            )}
          </p>
        </div>
        
        {hasOverride && (
          <div className="flex items-center gap-2">
            <Select 
              value={override.override_type} 
              onValueChange={(v) => handleOverrideChange(itemType, itemId, v as OverrideType, override.override_value || undefined)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiplier">
                  <div className="flex items-center gap-2">
                    <Percent className="h-3 w-3" />
                    Multiplicateur
                  </div>
                </SelectItem>
                <SelectItem value="fixed_value">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3" />
                    Valeur fixe
                  </div>
                </SelectItem>
                <SelectItem value="disabled">
                  <div className="flex items-center gap-2">
                    <Ban className="h-3 w-3" />
                    Désactivé
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {override.override_type !== 'disabled' && (
              <Input
                type="number"
                className="w-24"
                value={override.override_value || ''}
                onChange={(e) => handleOverrideChange(
                  itemType, 
                  itemId, 
                  override.override_type, 
                  parseFloat(e.target.value) || undefined
                )}
                placeholder={override.override_type === 'multiplier' ? '1.0' : '0'}
                step={override.override_type === 'multiplier' ? '0.1' : '100'}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Variations par ligne - {scenario.name}</DialogTitle>
          <DialogDescription>
            Ajustez individuellement chaque élément pour ce scénario
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ItemType)} className="flex-1 overflow-hidden">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="revenue_stream">
              Revenus
              {overrides.filter(o => o.item_type === 'revenue_stream').length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {overrides.filter(o => o.item_type === 'revenue_stream').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="fixed_expense">
              Charges
              {overrides.filter(o => o.item_type === 'fixed_expense').length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {overrides.filter(o => o.item_type === 'fixed_expense').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="personnel">
              Personnel
              {overrides.filter(o => o.item_type === 'personnel').length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {overrides.filter(o => o.item_type === 'personnel').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-4 overflow-y-auto max-h-[400px] pr-2">
            <TabsContent value="revenue_stream" className="m-0">
              {revenueStreams.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Aucun flux de revenus configuré
                </p>
              ) : (
                revenueStreams.map(stream => (
                  <OverrideRow 
                    key={stream.id}
                    itemType="revenue_stream"
                    itemId={stream.id}
                    name={stream.name}
                    originalValue={Number(stream.monthly_price) || 0}
                  />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="fixed_expense" className="m-0">
              {fixedExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Aucune charge fixe configurée
                </p>
              ) : (
                fixedExpenses.map(expense => (
                  <OverrideRow 
                    key={expense.id}
                    itemType="fixed_expense"
                    itemId={expense.id}
                    name={expense.name}
                    originalValue={Number(expense.monthly_amount) || 0}
                  />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="personnel" className="m-0">
              {personnel.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Aucun personnel configuré
                </p>
              ) : (
                personnel.map(person => (
                  <OverrideRow 
                    key={person.id}
                    itemType="personnel"
                    itemId={person.id}
                    name={person.position}
                    originalValue={Number(person.gross_salary) || 0}
                  />
                ))
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
