import { useState, useEffect } from 'react';
import { Settings2, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Company } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BridgeAccount {
  id: string;
  bridge_account_id: number;
  name: string | null;
  iban: string | null;
  balance: number | null;
  account_type: string | null;
}

interface ManageAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  onSuccess: () => void;
}

export function ManageAccountsDialog({
  open,
  onOpenChange,
  company,
  onSuccess,
}: ManageAccountsDialogProps) {
  const [accounts, setAccounts] = useState<BridgeAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load all available Bridge accounts and current assignments
  useEffect(() => {
    if (!open || !company?.bridge_user_uuid) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch all Bridge accounts for this bridge_user_uuid
        const { data: bridgeAccounts, error: accountsError } = await supabase
          .from('bridge_accounts')
          .select('id, bridge_account_id, name, iban, balance, account_type')
          .eq('bridge_user_uuid', company.bridge_user_uuid);

        if (accountsError) throw accountsError;

        // Fetch current assignments for this company
        const { data: assignments, error: assignmentsError } = await supabase
          .from('company_bridge_accounts')
          .select('bridge_account_id')
          .eq('company_id', company.id);

        if (assignmentsError) throw assignmentsError;

        setAccounts(bridgeAccounts || []);
        
        // If no assignments exist yet, select all by default
        if (!assignments || assignments.length === 0) {
          setSelectedAccountIds(new Set((bridgeAccounts || []).map(a => a.bridge_account_id)));
        } else {
          setSelectedAccountIds(new Set(assignments.map(a => a.bridge_account_id)));
        }
      } catch (error) {
        console.error('Failed to load accounts:', error);
        toast.error('Erreur lors du chargement des comptes');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [open, company]);

  const handleToggle = (bridgeAccountId: number) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(bridgeAccountId)) {
        next.delete(bridgeAccountId);
      } else {
        next.add(bridgeAccountId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!company) return;

    setIsSaving(true);
    try {
      // Delete all current assignments
      const { error: deleteError } = await supabase
        .from('company_bridge_accounts')
        .delete()
        .eq('company_id', company.id);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (selectedAccountIds.size > 0) {
        const inserts = Array.from(selectedAccountIds).map(bridge_account_id => ({
          company_id: company.id,
          bridge_account_id,
        }));

        const { error: insertError } = await supabase
          .from('company_bridge_accounts')
          .insert(inserts);

        if (insertError) throw insertError;
      }

      // Update company's bridge_accounts_count
      const { error: updateError } = await supabase
        .from('companies')
        .update({ 
          bridge_accounts_count: selectedAccountIds.size,
          bank_balance: accounts
            .filter(a => selectedAccountIds.has(a.bridge_account_id))
            .reduce((sum, a) => sum + (a.balance || 0), 0),
        })
        .eq('id', company.id);

      if (updateError) throw updateError;

      toast.success(`${selectedAccountIds.size} compte${selectedAccountIds.size > 1 ? 's' : ''} assigné${selectedAccountIds.size > 1 ? 's' : ''} à ${company.name}`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const formatBalance = (balance: number | null) => {
    if (balance === null) return '-';
    return balance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Gérer les comptes de {company?.name}
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les comptes bancaires à associer à cette société.
            Seules les transactions de ces comptes seront synchronisées.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Aucun compte bancaire disponible.
            </p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleToggle(account.bridge_account_id)}
                >
                  <Checkbox
                    id={account.id}
                    checked={selectedAccountIds.has(account.bridge_account_id)}
                    onCheckedChange={() => handleToggle(account.bridge_account_id)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={account.id} className="flex-1 cursor-pointer">
                    <div className="font-medium text-foreground">
                      {account.name || 'Compte sans nom'}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      {account.iban && (
                        <span className="font-mono text-xs">
                          {account.iban.replace(/(.{4})/g, '$1 ').trim().slice(-14)}
                        </span>
                      )}
                      {account.account_type && (
                        <span className="capitalize">{account.account_type}</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-medium text-primary">
                      {formatBalance(account.balance)}
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground mr-auto">
            {selectedAccountIds.size} / {accounts.length} sélectionné{selectedAccountIds.size > 1 ? 's' : ''}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
