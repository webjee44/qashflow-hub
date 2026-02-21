import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logError } from '@/lib/logger';

// 👇 Modifiez ce lien avec votre URL Calendly
const CALENDLY_URL = 'https://calendly.com/votre-lien/setup-15min';

const POPUP_DELAY_MS = 45_000;

export function CalendlyPopup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Load dismissed state
  useEffect(() => {
    if (!user) return;
    (supabase
      .from('profiles')
      .select('calendly_popup_dismissed')
      .eq('id', user.id)
      .single() as any)
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) {
          logError('CalendlyPopup: load dismissed', error);
          setDismissed(true);
          return;
        }
        setDismissed(data?.calendly_popup_dismissed ?? false);
      });
  }, [user]);

  // Start timer when we know it's not dismissed
  useEffect(() => {
    if (dismissed !== false) return;
    const timer = setTimeout(() => setOpen(true), POPUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const handleDismiss = async () => {
    setOpen(false);
    setDismissed(true);
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ calendly_popup_dismissed: true } as any)
      .eq('id', user.id);
  };

  const handleBook = () => {
    window.open(CALENDLY_URL, '_blank', 'noopener');
    handleDismiss();
  };

  if (dismissed !== false) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Calendar className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">
            👋 Besoin d'un coup de pouce ?
          </DialogTitle>
          <DialogDescription className="text-base">
            Réservez un appel gratuit de 15 min avec notre équipe pour configurer votre compte ensemble.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleBook} className="w-full">
            <Calendar className="mr-2 h-4 w-4" />
            Réserver mon appel gratuit
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full">
            Plus tard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
