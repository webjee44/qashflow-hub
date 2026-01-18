import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RevenueStream } from '@/hooks/useRevenueStreams';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';

interface RevenueStreamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stream?: RevenueStream | null;
  onSave: (data: Partial<RevenueStream>) => void;
}

const DEFAULT_COLOR = 'hsl(142, 76%, 36%)';

type ModelType = 'variable' | 'subscription';

export function RevenueStreamDialog({ open, onOpenChange, stream, onSave }: RevenueStreamDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<ModelType>('variable');
  
  // Subscription model fields
  const [initialSubscribers, setInitialSubscribers] = useState('0');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [churnRate, setChurnRate] = useState('5');
  const [growthRate, setGrowthRate] = useState('10');
  
  // Year-specific annual growth rates (only N+1 and N+2 for 3-year BP)
  const [growthRateYear2, setGrowthRateYear2] = useState('10');
  const [growthRateYear3, setGrowthRateYear3] = useState('10');

  useEffect(() => {
    if (stream) {
      setName(stream.name);
      setDescription(stream.description || '');
      // Map old models to new ones
      const mappedModel = stream.model === 'subscription' ? 'subscription' : 'variable';
      setModel(mappedModel);
      setInitialSubscribers(stream.initial_subscribers?.toString() || '0');
      setMonthlyPrice(stream.monthly_price?.toString() || '');
      setChurnRate(((stream.churn_rate || 0.05) * 100).toString());
      setGrowthRate(((stream.growth_rate || 0.10) * 100).toString());
      setGrowthRateYear2(((stream.growth_rate_year2 ?? stream.annual_growth_rate ?? 0.10) * 100).toString());
      setGrowthRateYear3(((stream.growth_rate_year3 ?? stream.annual_growth_rate ?? 0.10) * 100).toString());
    } else {
      setName('');
      setDescription('');
      setModel('variable');
      setInitialSubscribers('0');
      setMonthlyPrice('');
      setChurnRate('5');
      setGrowthRate('10');
      setGrowthRateYear2('10');
      setGrowthRateYear3('10');
    }
  }, [stream, open]);

  const handleSave = () => {
    // Use isNaN check to allow 0 as a valid value
    const parseRate = (value: string, defaultVal: number) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultVal : parsed;
    };
    
    const rate2 = parseRate(growthRateYear2, 10) / 100;
    const rate3 = parseRate(growthRateYear3, 10) / 100;
    
    onSave({
      id: stream?.id,
      name,
      description: description || null,
      color: stream?.color || DEFAULT_COLOR,
      model,
      initial_subscribers: parseInt(initialSubscribers) || 0,
      monthly_price: parseFloat(monthlyPrice) || 0,
      churn_rate: parseRate(churnRate, 5) / 100,
      growth_rate: parseRate(growthRate, 10) / 100,
      annual_growth_rate: rate2, // Keep for backwards compatibility
      growth_rate_year2: rate2,
      growth_rate_year3: rate3,
      growth_rate_year4: rate3, // Use rate3 for year4 as fallback
    });
    onOpenChange(false);
  };

  // Calculate preview for subscription model
  const subscribers = parseInt(initialSubscribers) || 0;
  const price = parseFloat(monthlyPrice) || 0;
  const churn = (parseFloat(churnRate) || 5) / 100;
  const growth = (parseFloat(growthRate) || 10) / 100;
  
  const initialMRR = subscribers * price;
  const month12Subscribers = Math.round(subscribers * Math.pow(1 + growth - churn, 12));
  const month12MRR = month12Subscribers * price;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{stream ? 'Modifier le flux' : 'Nouveau flux de revenus'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nom du flux</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Abonnements Pro"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce flux de revenus..."
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label>Modèle de calcul</Label>
            <Select value={model} onValueChange={(v) => setModel(v as ModelType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variable">CA variable (saisie mensuelle)</SelectItem>
                <SelectItem value="subscription">Abonnement / SaaS (MRR)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {model === 'variable' 
                ? 'Saisissez le CA mois par mois dans le tableau' 
                : 'Calcul automatique basé sur les abonnés et le prix mensuel'}
            </p>
          </div>

          {/* Year-specific growth rates (3-year BP: N+1 and N+2) */}
          <div className="grid gap-4 p-4 bg-muted/30 rounded-lg border">
            <Label className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Taux de croissance annuels
            </Label>
            <p className="text-xs text-muted-foreground -mt-2">
              Appliqués pour projeter le CA des années 2 et 3
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <Label htmlFor="growthYear2" className="text-xs text-muted-foreground">
                  N+1 (vs Année 1)
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="growthYear2"
                    type="number"
                    value={growthRateYear2}
                    onChange={(e) => setGrowthRateYear2(e.target.value)}
                    placeholder="10"
                    className="h-8"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="growthYear3" className="text-xs text-muted-foreground">
                  N+2 (vs Année 2)
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="growthYear3"
                    type="number"
                    value={growthRateYear3}
                    onChange={(e) => setGrowthRateYear3(e.target.value)}
                    placeholder="10"
                    className="h-8"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>
          {/* Subscription model specific fields */}
          {model === 'subscription' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Paramètres SaaS
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="subscribers">Abonnés initiaux</Label>
                  <Input
                    id="subscribers"
                    type="number"
                    value={initialSubscribers}
                    onChange={(e) => setInitialSubscribers(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Prix mensuel (€)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="29"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="growth" className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-success" />
                    Croissance (%/mois)
                  </Label>
                  <Input
                    id="growth"
                    type="number"
                    value={growthRate}
                    onChange={(e) => setGrowthRate(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="churn" className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-destructive" />
                    Churn (%/mois)
                  </Label>
                  <Input
                    id="churn"
                    type="number"
                    value={churnRate}
                    onChange={(e) => setChurnRate(e.target.value)}
                    placeholder="5"
                  />
                </div>
              </div>

              {/* Preview */}
              {subscribers > 0 && price > 0 && (
                <div className="pt-3 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">MRR initial</span>
                    <span className="font-medium">{formatCurrency(initialMRR)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Abonnés à M12</span>
                    <span className="font-medium">{month12Subscribers.toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>MRR à M12</span>
                    <span className="text-success">{formatCurrency(month12MRR)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ARR projeté : {formatCurrency(month12MRR * 12)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || (model === 'subscription' && !monthlyPrice)}>
            {stream ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}