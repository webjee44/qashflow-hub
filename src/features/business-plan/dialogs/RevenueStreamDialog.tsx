import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RevenueStream } from '@/hooks/useRevenueStreams';
import { Users, TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react';

interface RevenueStreamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stream?: RevenueStream | null;
  onSave: (data: Partial<RevenueStream>) => void;
}

const DEFAULT_COLOR = 'hsl(142, 76%, 36%)';

type ModelType = 'variable' | 'subscription';
type RevenueType = 'merchandise' | 'production';

export function RevenueStreamDialog({ open, onOpenChange, stream, onSave }: RevenueStreamDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<ModelType>('variable');
  const [revenueType, setRevenueType] = useState<RevenueType>('production');
  
  // Subscription model fields
  const [initialSubscribers, setInitialSubscribers] = useState('0');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [churnRate, setChurnRate] = useState('5');
  const [growthRate, setGrowthRate] = useState('10');
  
  // Year-specific annual growth rates (only N+1 and N+2 for 3-year BP)
  const [growthRateYear2, setGrowthRateYear2] = useState('10');
  const [growthRateYear3, setGrowthRateYear3] = useState('10');

  // Purchase cost fields
  const [hasPurchaseCost, setHasPurchaseCost] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchasePriceYear2, setPurchasePriceYear2] = useState('');
  const [purchasePriceYear3, setPurchasePriceYear3] = useState('');

  // One-shot (non-recurring) revenue
  const [isOneShot, setIsOneShot] = useState(false);

  useEffect(() => {
    if (stream) {
      setName(stream.name);
      setDescription(stream.description || '');
      // Map old models to new ones
      const mappedModel = stream.model === 'subscription' ? 'subscription' : 'variable';
      setModel(mappedModel);
      setRevenueType((stream as any).revenue_type || 'production');
      setInitialSubscribers(stream.initial_subscribers?.toString() || '0');
      setMonthlyPrice(stream.monthly_price?.toString() || '');
      setChurnRate(((stream.churn_rate || 0.05) * 100).toString());
      setGrowthRate(((stream.growth_rate || 0.10) * 100).toString());
      setGrowthRateYear2(((stream.growth_rate_year2 ?? stream.annual_growth_rate ?? 0.10) * 100).toString());
      setGrowthRateYear3(((stream.growth_rate_year3 ?? stream.annual_growth_rate ?? 0.10) * 100).toString());
      setHasPurchaseCost((stream as any).has_purchase_cost ?? false);
      setPurchasePrice((stream as any).purchase_price?.toString() || '');
      setPurchasePriceYear2(
        (stream as any).purchase_price_year2 !== null && (stream as any).purchase_price_year2 !== undefined
          ? String((stream as any).purchase_price_year2)
          : ''
      );
      setPurchasePriceYear3(
        (stream as any).purchase_price_year3 !== null && (stream as any).purchase_price_year3 !== undefined
          ? String((stream as any).purchase_price_year3)
          : ''
      );
      setIsOneShot((stream as any).is_one_shot ?? false);
    } else {
      setName('');
      setDescription('');
      setModel('variable');
      setRevenueType('production');
      setInitialSubscribers('0');
      setMonthlyPrice('');
      setChurnRate('5');
      setGrowthRate('10');
      setGrowthRateYear2('10');
      setGrowthRateYear3('10');
      setHasPurchaseCost(false);
      setPurchasePrice('');
      setPurchasePriceYear2('');
      setPurchasePriceYear3('');
      setIsOneShot(false);
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
      revenue_type: revenueType,
      initial_subscribers: parseInt(initialSubscribers) || 0,
      monthly_price: parseFloat(monthlyPrice) || 0,
      churn_rate: parseRate(churnRate, 5) / 100,
      growth_rate: parseRate(growthRate, 10) / 100,
      annual_growth_rate: rate2,
      growth_rate_year2: rate2,
      growth_rate_year3: rate3,
      growth_rate_year4: rate3,
      has_purchase_cost: hasPurchaseCost,
      purchase_price: parseFloat(purchasePrice) || 0,
      purchase_price_year2: purchasePriceYear2.trim() === '' ? null : (parseFloat(purchasePriceYear2) || 0),
      purchase_price_year3: purchasePriceYear3.trim() === '' ? null : (parseFloat(purchasePriceYear3) || 0),
      purchase_price_year4: purchasePriceYear3.trim() === '' ? null : (parseFloat(purchasePriceYear3) || 0),
      is_one_shot: isOneShot,
    } as any);
    onOpenChange(false);
  };

  // Calculate margin preview
  const sellingPrice = parseFloat(monthlyPrice) || 0;
  const purchaseCost = parseFloat(purchasePrice) || 0;
  const marginAmount = sellingPrice - purchaseCost;
  const marginPercent = sellingPrice > 0 ? (marginAmount / sellingPrice) * 100 : 0;

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
          
          {/* Revenue Type (PCG) */}
          <div className="grid gap-2">
            <Label>Type de revenu (PCG)</Label>
            <Select value={revenueType} onValueChange={(v) => setRevenueType(v as RevenueType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Prestation de services (706)</SelectItem>
                <SelectItem value="merchandise">Vente de marchandises (707)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {revenueType === 'merchandise' 
                ? 'Revente de produits achetés (e-commerce, négoce)' 
                : 'Services, conseil, SaaS, abonnements'}
            </p>
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

          {/* Purchase cost section */}
          <div className="grid gap-4 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label htmlFor="hasPurchaseCost" className="flex-1 cursor-pointer">
                Appliquer un coût d'achat sur ce flux
              </Label>
              <Switch
                id="hasPurchaseCost"
                checked={hasPurchaseCost}
                onCheckedChange={setHasPurchaseCost}
              />
            </div>
            
            {hasPurchaseCost && (
              <div className="flex items-center gap-3 pt-2 border-t">
                <Label htmlFor="purchasePercent" className="text-sm whitespace-nowrap">
                  % des achats
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="purchasePercent"
                    type="number"
                    min="0"
                    max="100"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="60"
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <span className="text-xs text-muted-foreground ml-auto">
                  = Marge brute de {(100 - (parseFloat(purchasePrice) || 0)).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* One-shot toggle */}
          <div className="grid gap-2 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isOneShot" className="cursor-pointer">
                  Produit exceptionnel (one-shot)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Revenu non récurrent : compté uniquement sur l'Année 1, ignoré sur les années suivantes.
                </p>
              </div>
              <Switch
                id="isOneShot"
                checked={isOneShot}
                onCheckedChange={setIsOneShot}
              />
            </div>
          </div>

          {/* Year-specific growth rates (3-year BP: N+1 and N+2) */}
          {!isOneShot && (
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
          )}
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