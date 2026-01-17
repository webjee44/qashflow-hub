import { useState } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { useSubscription, PLANS } from '@/hooks/useSubscription';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export const TrialExpiredBlocker = () => {
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const { subscribed, is_trialing, createCheckout, checkoutLoading } = useSubscription();
  const [isOpen, setIsOpen] = useState(true);

  // Don't show if still loading
  if (orgLoading) return null;

  // Don't show if no organization
  if (!currentOrganization) return null;

  // Don't show if user has active subscription
  if (subscribed) return null;

  // Don't show if user is still in trial period
  if (is_trialing) return null;

  // Check if trial has expired based on organization's trial_ends_at
  const trialEnded = currentOrganization.trial_ends_at 
    ? new Date(currentOrganization.trial_ends_at) < new Date()
    : false;

  // Check if status is trialing but trial has expired
  const isExpiredTrial = currentOrganization.subscription_status === 'trialing' && trialEnded;

  // Don't show blocker if trial hasn't expired
  if (!isExpiredTrial) return null;

  const handleSubscribe = async () => {
    try {
      await createCheckout(PLANS.pro.priceId);
      toast.success('Redirection vers la page de paiement...');
    } catch (error) {
      toast.error('Erreur lors de la création du checkout');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-2xl">Votre essai gratuit est terminé</DialogTitle>
          <DialogDescription className="text-base">
            Votre période d'essai de 30 jours est arrivée à son terme. 
            Pour continuer à utiliser qashflow, ajoutez un moyen de paiement.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Plan Pro</h3>
              <p className="text-muted-foreground text-sm">Accès complet</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{PLANS.pro.price}€</div>
              <div className="text-sm text-muted-foreground">/mois</div>
            </div>
          </div>
          
          <ul className="space-y-2 mb-4">
            {PLANS.pro.features.slice(0, 5).map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <Button 
            className="w-full h-12 text-lg" 
            size="lg"
            onClick={handleSubscribe}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CreditCard className="h-5 w-5 mr-2" />
            )}
            Ajouter un moyen de paiement
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Sans engagement • Annulable à tout moment
        </p>
      </DialogContent>
    </Dialog>
  );
};
