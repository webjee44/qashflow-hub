import { useState } from 'react';
import { Building2, Link, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Company } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LinkBridgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetCompany: Company | null;
  companiesWithBridge: Company[];
  onSuccess: () => void;
}

export function LinkBridgeDialog({
  open,
  onOpenChange,
  targetCompany,
  companiesWithBridge,
  onSuccess,
}: LinkBridgeDialogProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);

  const handleLink = async () => {
    if (!targetCompany || !selectedCompanyId) return;

    const sourceCompany = companiesWithBridge.find(c => c.id === selectedCompanyId);
    if (!sourceCompany?.bridge_user_uuid) return;

    setIsLinking(true);

    try {
      // Copy the bridge_user_uuid to the target company
      const { error } = await supabase
        .from('companies')
        .update({ bridge_user_uuid: sourceCompany.bridge_user_uuid })
        .eq('id', targetCompany.id);

      if (error) throw error;

      // Trigger a sync for the target company
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data, error: syncError } = await supabase.functions.invoke('bridge-sync', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: {
            action: 'full-sync',
            bridge_user_uuid: sourceCompany.bridge_user_uuid,
            company_id: targetCompany.id,
          },
        });

        if (syncError || !data?.success) {
          console.error('Sync error:', data?.error || syncError);
          toast.warning('Connexion liée, mais la synchronisation a échoué. Réessayez manuellement.');
        } else {
          const balance = data.totalBalance?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) || '0 €';
          toast.success(`Connexion Bridge liée ! ${data.accounts} comptes • ${balance}`);
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Link error:', error);
      toast.error('Erreur lors de la liaison Bridge');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Utiliser une connexion existante
          </DialogTitle>
          <DialogDescription>
            Liez {targetCompany?.name} à une connexion Bridge déjà configurée.
            Utile si vous utilisez les mêmes identifiants bancaires.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <div className="space-y-3">
              {companiesWithBridge.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <RadioGroupItem value={company.id} id={company.id} />
                  <Label htmlFor={company.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="font-medium">{company.name}</span>
                    </div>
                    {company.bridge_accounts_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {company.bridge_accounts_count} compte{company.bridge_accounts_count > 1 ? 's' : ''} connecté{company.bridge_accounts_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>

          {companiesWithBridge.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Aucune autre société n'a de connexion Bridge.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedCompanyId || isLinking}
            className="gap-2"
          >
            {isLinking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Liaison...
              </>
            ) : (
              <>
                <Link className="w-4 h-4" />
                Lier
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
