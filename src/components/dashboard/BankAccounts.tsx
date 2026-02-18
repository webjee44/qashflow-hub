import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Landmark, RefreshCw, Loader2, Building2, ArrowDownToLine, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';

type ItemStatus = 'ok' | 'needs_action' | 'error' | 'deleted';

interface BridgeAccount {
  id: string;
  name: string;
  balance: number;
  iban: string | null;
  type: string;
  updated_at: string;
  item_status: ItemStatus | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function BankAccounts() {
  const { currentCompany, refetch } = useCompany();
  const [accounts, setAccounts] = useState<BridgeAccount[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingTransactions, setSyncingTransactions] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [hasDisconnectedBank, setHasDisconnectedBank] = useState(false);

  const bridgeUserUuid = (currentCompany as any)?.bridge_user_uuid;

  const fetchAccounts = async () => {
    if (!bridgeUserUuid) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('bridge-accounts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: 'get-accounts',
          bridge_user_uuid: bridgeUserUuid,
          company_id: currentCompany?.id,
        },
      });

      if (error || !data?.success) {
        logError('Error fetching accounts:', data?.error || error);
        return;
      }

      const accountsList = data.accounts || [];
      setAccounts(accountsList);
      setTotalBalance(data.total_balance || 0);
      setLastSync(new Date().toISOString());
      
      // Check if any account has a disconnection issue
      const hasIssue = accountsList.some((a: BridgeAccount) => 
        a.item_status === 'needs_action' || a.item_status === 'error' || a.item_status === 'deleted'
      );
      setHasDisconnectedBank(hasIssue);
      
      await refetch();
    } catch (error) {
      logError('Error fetching Bridge accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetchAccounts();
      toast.success('Comptes synchronisés');
    } catch (error) {
      toast.error('Erreur de synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncTransactions = async () => {
    setSyncingTransactions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      const { data, error } = await supabase.functions.invoke('bridge-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: 'full-sync',
          bridge_user_uuid: bridgeUserUuid,
          company_id: currentCompany?.id,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Erreur de synchronisation');
        return;
      }

      toast.success(`${data.inserted} nouvelles transactions importées, ${data.updated} mises à jour`);
    } catch (error) {
      logError('Error syncing transactions:', error);
      toast.error('Erreur de synchronisation des transactions');
    } finally {
      setSyncingTransactions(false);
    }
  };

  useEffect(() => {
    if (bridgeUserUuid) {
      fetchAccounts();
    }
  }, [bridgeUserUuid, currentCompany?.id]);

  if (!bridgeUserUuid) {
    return null;
  }

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'checking':
        return <Landmark className="w-4 h-4 text-primary" />;
      case 'savings':
        return <Building2 className="w-4 h-4 text-green-500" />;
      default:
        return <Landmark className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking':
        return 'Compte courant';
      case 'savings':
        return 'Compte épargne';
      case 'card':
        return 'Carte';
      case 'loan':
        return 'Prêt';
      default:
        return type;
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Landmark className="w-5 h-5" />
          Comptes bancaires
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncTransactions}
            disabled={syncingTransactions || loading}
            className="gap-2"
          >
            {syncingTransactions ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="w-4 h-4" />
            )}
            Importer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={syncing || loading}
            className="gap-2"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hasDisconnectedBank && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Une ou plusieurs banques nécessitent une reconnexion</span>
              <Button variant="outline" size="sm" asChild>
                <Link to="/parametres#accounts">Reconnecter</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {loading && accounts.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Landmark className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun compte connecté</p>
            <p className="text-xs mt-1">Allez dans Paramètres pour connecter vos banques</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{account.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getAccountTypeLabel(account.type)}
                      {account.iban && ` • ${account.iban.slice(-4)}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${account.balance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    {formatCurrency(account.balance)}
                  </p>
                </div>
              </motion.div>
            ))}

            {/* Total */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
              <span className="font-medium text-foreground">Solde total</span>
              <span className={`text-lg font-bold ${totalBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(totalBalance)}
              </span>
            </div>

            {/* Last sync */}
            {currentCompany?.bank_balance_updated_at && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Dernière sync: {format(new Date(currentCompany.bank_balance_updated_at), "d MMM 'à' HH:mm", { locale: fr })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
