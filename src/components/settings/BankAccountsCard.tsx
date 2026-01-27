import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Loader2, Check, X, Building2, Plus, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';

interface BridgeAccount {
  id: string;
  bridge_account_id: number;
  bridge_item_id: number;
  name: string | null;
  iban: string | null;
  balance: number | null;
  account_type: string | null;
  bridge_user_uuid: string;
  company_id: string;
}

interface BankGroup {
  bankName: string;
  accounts: BridgeAccount[];
  totalBalance: number;
}

// Extract bank name from account name (format: "BankName - AccountName")
const extractBankName = (accountName: string | null): string => {
  if (!accountName) return 'Banque inconnue';
  const parts = accountName.split(' - ');
  return parts.length > 1 ? parts[0].trim() : 'Banque inconnue';
};

// Group accounts by bank
const groupAccountsByBank = (accounts: BridgeAccount[]): BankGroup[] => {
  const groups = new Map<number, BankGroup>();
  
  accounts.forEach(account => {
    const itemId = account.bridge_item_id;
    if (!groups.has(itemId)) {
      groups.set(itemId, {
        bankName: extractBankName(account.name),
        accounts: [],
        totalBalance: 0,
      });
    }
    const group = groups.get(itemId)!;
    group.accounts.push(account);
    group.totalBalance += account.balance || 0;
  });
  
  // Sort groups by bank name and accounts within each group
  return Array.from(groups.values())
    .sort((a, b) => a.bankName.localeCompare(b.bankName))
    .map(group => ({
      ...group,
      accounts: group.accounts.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    }));
};

interface AccountAssignment {
  bridge_account_id: number;
  company_id: string | null;
  is_enabled: boolean;
}

export function BankAccountsCard() {
  const { companies, refetch: refetchCompanies } = useCompany();
  const [accounts, setAccounts] = useState<BridgeAccount[]>([]);
  const [assignments, setAssignments] = useState<Map<number, AccountAssignment>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Get unique bridge_user_uuids from companies
  const bridgeUserUuids = [...new Set(
    companies
      .filter(c => c.bridge_user_uuid)
      .map(c => c.bridge_user_uuid as string)
  )];

  // Load all Bridge accounts
  useEffect(() => {
    if (bridgeUserUuids.length === 0) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch all Bridge accounts for all bridge_user_uuids
        const { data: bridgeAccounts, error: accountsError } = await supabase
          .from('bridge_accounts')
          .select('id, bridge_account_id, bridge_item_id, name, iban, balance, account_type, bridge_user_uuid, company_id')
          .in('bridge_user_uuid', bridgeUserUuids);

        if (accountsError) throw accountsError;

        // Fetch current assignments
        const { data: currentAssignments, error: assignmentsError } = await supabase
          .from('company_bridge_accounts')
          .select('bridge_account_id, company_id');

        if (assignmentsError) throw assignmentsError;

        setAccounts(bridgeAccounts || []);

        // Build assignments map
        const assignmentMap = new Map<number, AccountAssignment>();
        (bridgeAccounts || []).forEach(account => {
          const existing = currentAssignments?.find(a => a.bridge_account_id === account.bridge_account_id);
          assignmentMap.set(account.bridge_account_id, {
            bridge_account_id: account.bridge_account_id,
            company_id: existing?.company_id || null,
            is_enabled: existing !== undefined,
          });
        });
        setAssignments(assignmentMap);
      } catch (error) {
        console.error('Failed to load accounts:', error);
        toast.error('Erreur lors du chargement des comptes');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [bridgeUserUuids.join(',')]);

  // Auto-sync after Bridge connection (check localStorage flag)
  useEffect(() => {
    const pendingSync = localStorage.getItem('bridgePendingSync');
    if (pendingSync !== 'true') return;
    
    // Clear the flag immediately to prevent multiple syncs
    localStorage.removeItem('bridgePendingSync');
    
    const autoSync = async () => {
      const companiesWithBridge = companies.filter(c => c.bridge_user_uuid);
      if (companiesWithBridge.length === 0) {
        // Refetch to get latest bridge_user_uuid
        const { data: freshCompanies } = await supabase
          .from('companies')
          .select('id, bridge_user_uuid')
          .not('bridge_user_uuid', 'is', null);
        
        if (!freshCompanies || freshCompanies.length === 0) {
          return;
        }
        
        await runAutoSync(freshCompanies);
      } else {
        await runAutoSync(companiesWithBridge);
      }
    };
    
    autoSync();
  }, [companies]);

  const runAutoSync = async (companiesWithBridge: Array<{ id: string; bridge_user_uuid: string | null }>) => {
    setIsSyncing(true);
    toast.info('Synchronisation automatique des comptes...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée');
        return;
      }

      let totalAccounts = 0;
      
      for (const company of companiesWithBridge) {
        if (!company.bridge_user_uuid) continue;
        
        const { data, error } = await supabase.functions.invoke('bridge-sync', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { 
            action: 'full-sync',
            bridge_user_uuid: company.bridge_user_uuid,
            company_id: company.id,
          },
        });

        if (!error && data?.success) {
          totalAccounts += data.accounts || 0;
        }
      }

      toast.success(`${totalAccounts} comptes synchronisés !`);
      
      // Reload to refresh the accounts list
      window.location.reload();
    } catch (error) {
      console.error('Auto sync error:', error);
      toast.error('Erreur lors de la synchronisation automatique');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggle = (bridgeAccountId: number, enabled: boolean) => {
    setAssignments(prev => {
      const next = new Map(prev);
      const current = next.get(bridgeAccountId);
      if (current) {
        next.set(bridgeAccountId, { ...current, is_enabled: enabled });
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleCompanyChange = (bridgeAccountId: number, companyId: string) => {
    setAssignments(prev => {
      const next = new Map(prev);
      const current = next.get(bridgeAccountId);
      if (current) {
        next.set(bridgeAccountId, { 
          ...current, 
          company_id: companyId === 'none' ? null : companyId,
          is_enabled: companyId !== 'none' ? true : current.is_enabled
        });
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Delete all current assignments
      const { error: deleteError } = await supabase
        .from('company_bridge_accounts')
        .delete()
        .in('bridge_account_id', accounts.map(a => a.bridge_account_id));

      if (deleteError) throw deleteError;

      // Insert new assignments (only enabled ones with a company)
      const newAssignments = Array.from(assignments.values())
        .filter(a => a.is_enabled && a.company_id);

      if (newAssignments.length > 0) {
        const { error: insertError } = await supabase
          .from('company_bridge_accounts')
          .insert(newAssignments.map(a => ({
            company_id: a.company_id!,
            bridge_account_id: a.bridge_account_id,
          })));

        if (insertError) throw insertError;
      }

      // Update company bank balances and counts
      for (const company of companies) {
        const companyAccounts = accounts.filter(account => {
          const assignment = assignments.get(account.bridge_account_id);
          return assignment?.is_enabled && assignment?.company_id === company.id;
        });

        const { error: updateError } = await supabase
          .from('companies')
          .update({
            bridge_accounts_count: companyAccounts.length,
            bank_balance: companyAccounts.reduce((sum, a) => sum + (a.balance || 0), 0),
          })
          .eq('id', company.id);

        if (updateError) throw updateError;
      }

      toast.success('Configuration des comptes enregistrée');
      setHasChanges(false);
      refetchCompanies();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
    setIsSaving(false);
    }
  };

  const handleConnectBridge = async () => {
    setIsConnecting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      // Refetch companies to get latest bridge_user_uuid state
      const { data: freshCompanies } = await supabase
        .from('companies')
        .select('id, bridge_user_uuid')
        .not('deleted_at', 'is', null)
        .or('deleted_at.is.null');
      
      // Get fresh bridge_user_uuid from refetched data
      let bridgeUserUuid = freshCompanies?.find(c => c.bridge_user_uuid)?.bridge_user_uuid || null;
      
      if (!bridgeUserUuid) {
        // Create Bridge user via bridge-auth function
        const { data: createData, error: createError } = await supabase.functions.invoke('bridge-auth', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { action: 'create-user' },
        });

        if (createError || !createData?.success) {
          toast.error(createData?.error || 'Erreur lors de la création de l\'utilisateur Bridge');
          return;
        }

        bridgeUserUuid = createData.user.uuid;
        
        // Save the Bridge user UUID to the first company
        const targetCompanyId = freshCompanies?.[0]?.id || companies[0]?.id;
        if (targetCompanyId) {
          await supabase
            .from('companies')
            .update({ bridge_user_uuid: bridgeUserUuid })
            .eq('id', targetCompanyId);
        }
      }

      const redirectUrl = `${window.location.origin}/parametres?tab=accounts&bridge_callback=success`;

      // Create Connect session
      const { data: connectData, error: connectError } = await supabase.functions.invoke('bridge-connect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { 
          bridge_user_uuid: bridgeUserUuid,
          redirect_url: redirectUrl,
        },
      });

      if (connectError || !connectData?.success) {
        toast.error(connectData?.error || 'Erreur lors de la création de la session Bridge');
        return;
      }

      localStorage.setItem('bridgePendingSync', 'true');
      toast.success('Redirection vers Bridge…');

      const inIframe = (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();

      if (inIframe) {
        window.open(connectData.connect_url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.assign(connectData.connect_url);
      }
    } catch (error) {
      console.error('Bridge connect error:', error);
      toast.error('Erreur lors de la connexion Bridge');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFullSync = async () => {
    const companiesWithBridgeConnection = companies.filter(c => c.bridge_user_uuid);
    
    if (companiesWithBridgeConnection.length === 0) {
      toast.error('Connectez d\'abord une banque');
      return;
    }

    setIsSyncing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalAccounts = 0;

      // Sync each company with bridge connection
      for (const company of companiesWithBridgeConnection) {
        const { data, error } = await supabase.functions.invoke('bridge-sync', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { 
            action: accounts.length === 0 ? 'sync-accounts' : 'full-sync',
            bridge_user_uuid: company.bridge_user_uuid,
            company_id: company.id,
          },
        });

        if (error) {
          console.error(`Sync error for ${company.name}:`, error);
        } else if (data?.success) {
          totalInserted += data.inserted || 0;
          totalUpdated += data.updated || 0;
          totalAccounts += data.accounts || 0;
        }
      }

      toast.success(`${totalAccounts} comptes synchronisés • ${totalInserted} nouvelles transactions, ${totalUpdated} mises à jour`);
      
      // Reload the page to refresh accounts list
      window.location.reload();
    } catch (error) {
      console.error('Full sync error:', error);
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatBalance = (balance: number | null) => {
    if (balance === null) return '-';
    return balance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  const formatIban = (iban: string | null) => {
    if (!iban) return '';
    return '•••• ' + iban.slice(-4);
  };

  // Get companies that can receive accounts (have bridge connection)
  const companiesWithBridge = companies.filter(c => c.bridge_user_uuid);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Check if any company has a bridge connection (for showing sync button)
  const hasAnyBridgeConnection = companies.some(c => c.bridge_user_uuid);

  if (accounts.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              Comptes bancaires
            </CardTitle>
            <CardDescription>
              Connectez vos banques et gérez la répartition entre vos sociétés
            </CardDescription>
          </div>
          {hasAnyBridgeConnection && (
            <Button
              variant="outline"
              onClick={handleFullSync}
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Synchroniser
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Landmark className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              {hasAnyBridgeConnection 
                ? "Cliquez sur Synchroniser pour récupérer vos comptes." 
                : "Aucun compte bancaire connecté."}
            </p>
            <Button 
              onClick={handleConnectBridge} 
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {hasAnyBridgeConnection ? "Ajouter une banque" : "Connecter une banque"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Comptes bancaires
          </CardTitle>
          <CardDescription>
            Activez/désactivez les comptes et assignez-les à vos sociétés
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleConnectBridge}
            disabled={isConnecting}
            className="gap-2"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Ajouter banque
          </Button>
          <Button
            variant="outline"
            onClick={handleFullSync}
            disabled={isSyncing}
            className="gap-2"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Synchroniser
          </Button>
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Enregistrer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <BankAccountsList 
          accounts={accounts}
          assignments={assignments}
          companies={companies}
          companiesWithBridge={companiesWithBridge}
          onToggle={handleToggle}
          onCompanyChange={handleCompanyChange}
          formatBalance={formatBalance}
          formatIban={formatIban}
        />

        {hasChanges && (
          <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
            💡 N'oubliez pas d'enregistrer vos modifications
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Separate component for the accounts list grouped by bank
function BankAccountsList({
  accounts,
  assignments,
  companies,
  companiesWithBridge,
  onToggle,
  onCompanyChange,
  formatBalance,
  formatIban,
}: {
  accounts: BridgeAccount[];
  assignments: Map<number, AccountAssignment>;
  companies: { id: string; name: string }[];
  companiesWithBridge: { id: string; name: string }[];
  onToggle: (bridgeAccountId: number, enabled: boolean) => void;
  onCompanyChange: (bridgeAccountId: number, companyId: string) => void;
  formatBalance: (balance: number | null) => string;
  formatIban: (iban: string | null) => string;
}) {
  const bankGroups = useMemo(() => groupAccountsByBank(accounts), [accounts]);
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(() => 
    new Set(bankGroups.map(g => g.bankName))
  );

  const toggleBank = (bankName: string) => {
    setExpandedBanks(prev => {
      const next = new Set(prev);
      if (next.has(bankName)) {
        next.delete(bankName);
      } else {
        next.add(bankName);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {bankGroups.map((group) => {
        const isExpanded = expandedBanks.has(group.bankName);
        
        return (
          <Collapsible 
            key={group.bankName} 
            open={isExpanded}
            onOpenChange={() => toggleBank(group.bankName)}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Landmark className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">{group.bankName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {group.accounts.length} compte{group.accounts.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <span className="font-semibold text-foreground">
                  {formatBalance(group.totalBalance)}
                </span>
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="mt-2 ml-4 space-y-2 border-l-2 border-muted pl-4">
                {group.accounts.map((account, index) => {
                  const assignment = assignments.get(account.bridge_account_id);
                  const isEnabled = assignment?.is_enabled ?? false;
                  const companyId = assignment?.company_id || 'none';
                  
                  // Extract account name without bank prefix
                  const displayName = account.name?.includes(' - ') 
                    ? account.name.split(' - ').slice(1).join(' - ')
                    : account.name || 'Compte sans nom';

                  return (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                        isEnabled 
                          ? 'border-border bg-card' 
                          : 'border-dashed border-muted bg-muted/30 opacity-60'
                      }`}
                    >
                      {/* Toggle */}
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => onToggle(account.bridge_account_id, checked)}
                      />

                      {/* Account info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">
                            {displayName}
                          </span>
                          {account.account_type && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {account.account_type}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {account.iban && (
                            <span className="font-mono text-xs">
                              {formatIban(account.iban)}
                            </span>
                          )}
                          <span className="font-medium text-primary">
                            {formatBalance(account.balance)}
                          </span>
                        </div>
                      </div>

                      {/* Company selector */}
                      <div className="w-48">
                        <Select
                          value={companyId}
                          onValueChange={(value) => onCompanyChange(account.bridge_account_id, value)}
                          disabled={!isEnabled}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Assigner à...">
                              {companyId !== 'none' ? (
                                <span className="flex items-center gap-2">
                                  <Building2 className="w-3 h-3" />
                                  {companies.find(c => c.id === companyId)?.name || 'Société'}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Non assigné</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border z-50">
                            <SelectItem value="none">
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <X className="w-3 h-3" />
                                Non assigné
                              </span>
                            </SelectItem>
                            {companiesWithBridge.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                <span className="flex items-center gap-2">
                                  <Building2 className="w-3 h-3" />
                                  {company.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
