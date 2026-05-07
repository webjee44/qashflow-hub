import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Loader2, Check, X, Building2, Plus, RefreshCw, ChevronDown, ChevronRight, Pencil, AlertTriangle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { logError, logDebug } from '@/lib/logger';

type ItemStatus = 'ok' | 'needs_action' | 'error' | 'deleted';

interface BridgeAccount {
  id: string;
  bridge_account_id: number;
  bridge_item_id: number;
  name: string | null;
  iban: string | null;
  balance: number | null;
  account_type: string | null;
  bank_name: string | null;
  bridge_user_uuid: string;
  company_id: string;
  item_status: ItemStatus | null;
  item_status_message: string | null;
}

interface BankGroup {
  bankName: string;
  accounts: BridgeAccount[];
  totalBalance: number;
  itemStatus: ItemStatus | null;
  itemStatusMessage: string | null;
  bridgeItemId: number;
  bridgeUserUuid: string;
}

// Helper to get worst status
function getWorstStatus(a: ItemStatus | null, b: ItemStatus | null): ItemStatus | null {
  if (a === 'error' || a === 'deleted' || b === 'error' || b === 'deleted') return 'error';
  if (a === 'needs_action' || b === 'needs_action') return 'needs_action';
  return a || b;
}

// Group accounts by bank (using bank_name from DB, fallback to bridge_item_id grouping)
const groupAccountsByBank = (accounts: BridgeAccount[]): BankGroup[] => {
  const groups = new Map<number, BankGroup>();
  
  accounts.forEach(account => {
    const itemId = account.bridge_item_id;
    if (!groups.has(itemId)) {
      groups.set(itemId, {
        // Use bank_name from database if available, otherwise fallback
        bankName: account.bank_name || 'Banque',
        accounts: [],
        totalBalance: 0,
        itemStatus: account.item_status,
        itemStatusMessage: account.item_status_message,
        bridgeItemId: itemId,
        bridgeUserUuid: account.bridge_user_uuid,
      });
    }
    const group = groups.get(itemId)!;
    group.accounts.push(account);
    group.totalBalance += account.balance || 0;
    // Use worst status in group
    const newStatus = getWorstStatus(group.itemStatus, account.item_status);
    if (newStatus !== group.itemStatus) {
      group.itemStatus = newStatus;
      if (account.item_status === 'needs_action' || account.item_status === 'error' || account.item_status === 'deleted') {
        group.itemStatusMessage = account.item_status_message;
      }
    }
  });
  
  // Sort groups by bank name and accounts within each group
  return Array.from(groups.values())
    .sort((a, b) => a.bankName.localeCompare(b.bankName))
    .map(group => ({
      ...group,
      accounts: group.accounts.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    }));
};

// Status badge component
function StatusBadge({ status, message }: { status: ItemStatus | null; message?: string | null }) {
  if (!status || status === 'ok') {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
        Connecté
      </Badge>
    );
  }
  
  if (status === 'needs_action') {
    return (
      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs" title={message || undefined}>
        <AlertTriangle className="w-3 h-3 mr-1" />
        Action requise
      </Badge>
    );
  }
  
  if (status === 'error' || status === 'deleted') {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs" title={message || undefined}>
        <X className="w-3 h-3 mr-1" />
        Erreur
      </Badge>
    );
  }
  
  return null;
}
interface AccountAssignment {
  bridge_account_id: number;
  company_id: string | null;
  is_enabled: boolean;
  status?: 'active' | 'excluded';
}

interface OrgCompanyOption {
  id: string;
  name: string;
  bridge_user_uuid: string | null;
}

export function BankAccountsCard() {
  const { companies, currentCompany, refetch: refetchCompanies } = useCompany();
  const { isOwner, isAdmin, currentOrganization } = useOrganization();
  const isOrgAdmin = isOwner || isAdmin;

  // Résolution des noms de sociétés : on charge dynamiquement TOUTES les sociétés
  // référencées (org courante + sociétés assignées aux comptes affichés, qui peuvent
  // appartenir à d'autres orgs en mode super-admin/impersonation).
  const [resolvedCompanies, setResolvedCompanies] = useState<Map<string, string>>(new Map());

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    // Base : sociétés du hook useCompany
    companies.forEach(c => map.set(c.id, c.name));
    // Surcharge / complément : sociétés résolues dynamiquement
    resolvedCompanies.forEach((name, id) => map.set(id, name));
    return map;
  }, [companies, resolvedCompanies]);

  // Liste des sociétés sélectionnables dans le dropdown (org courante uniquement)
  const [orgCompanies, setOrgCompanies] = useState<OrgCompanyOption[]>([]);

  useEffect(() => {
    const loadOrgCompanies = async () => {
      if (!currentOrganization?.id) {
        setOrgCompanies(companies.map(c => ({ id: c.id, name: c.name, bridge_user_uuid: c.bridge_user_uuid })));
        return;
      }
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, bridge_user_uuid')
        .eq('organization_id', currentOrganization.id)
        .is('deleted_at', null)
        .order('name');
      if (error) {
        logError('Failed to load org companies:', error);
        setOrgCompanies(companies.map(c => ({ id: c.id, name: c.name, bridge_user_uuid: c.bridge_user_uuid })));
        return;
      }
      setOrgCompanies((data || []) as OrgCompanyOption[]);
      // Alimente aussi la résolution des noms
      setResolvedCompanies(prev => {
        const next = new Map(prev);
        (data || []).forEach(c => next.set(c.id, c.name));
        return next;
      });
    };
    loadOrgCompanies();
  }, [currentOrganization?.id, companies]);

  const allCompanies = useMemo(() => (
    orgCompanies.length > 0
      ? orgCompanies
      : companies.map(c => ({ id: c.id, name: c.name, bridge_user_uuid: c.bridge_user_uuid }))
  ), [orgCompanies, companies]);
  const orgCompanyIds = useMemo(() => allCompanies.map(c => c.id), [allCompanies]);

  const [accounts, setAccounts] = useState<BridgeAccount[]>([]);
  const [excludedAccounts, setExcludedAccounts] = useState<BridgeAccount[]>([]);
  const [assignments, setAssignments] = useState<Map<number, AccountAssignment>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [reintegratingId, setReintegratingId] = useState<number | null>(null);

  // Filter displayed accounts based on role
  const displayedAccounts = useMemo(() => {
    if (isOrgAdmin) {
      return accounts;
    }
    // For members: only show accounts assigned to their current company
    return accounts.filter(account => {
      const assignment = assignments.get(account.bridge_account_id);
      return assignment?.is_enabled && assignment?.company_id === currentCompany?.id;
    });
  }, [isOrgAdmin, accounts, assignments, currentCompany?.id]);

  // Calculate total balance for displayed accounts
  const totalDisplayedBalance = useMemo(() => {
    return displayedAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
  }, [displayedAccounts]);

  // Load Bridge accounts: actifs (vue) + exclus (table) — source unique de vérité.
  useEffect(() => {
    const scopedCompanyIds = isOrgAdmin ? orgCompanyIds : (currentCompany?.id ? [currentCompany.id] : []);
    if (scopedCompanyIds.length === 0) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        // 1. Comptes ACTIFS — vue Qashflow
        const { data, error } = await supabase
          .from('company_active_bridge_accounts')
          .select('company_id, bridge_account_id, bridge_item_id, name, iban, balance, account_type, bank_name, bridge_user_uuid, item_status')
          .in('company_id', scopedCompanyIds);
        if (error) throw error;

        const bridgeAccounts: BridgeAccount[] = (data || []).map(row => ({
          id: `${row.company_id}:${row.bridge_account_id}`,
          bridge_account_id: row.bridge_account_id,
          bridge_item_id: row.bridge_item_id ?? row.bridge_account_id,
          name: row.name,
          iban: row.iban,
          balance: row.balance === null ? null : Number(row.balance),
          account_type: row.account_type,
          bank_name: row.bank_name,
          bridge_user_uuid: row.bridge_user_uuid,
          company_id: row.company_id,
          item_status: ['ok', 'needs_action', 'error', 'deleted'].includes(row.item_status || '')
            ? row.item_status as ItemStatus
            : null,
          item_status_message: null,
        }));

        setAccounts(bridgeAccounts);

        // 2. Comptes EXCLUS — table cba + jointure bridge_accounts
        // Admin uniquement (les membres ne pilotent pas l'exclusion).
        if (isOrgAdmin) {
          const { data: excludedRows, error: excludedErr } = await supabase
            .from('company_bridge_accounts')
            .select(`
              company_id,
              bridge_account_id,
              status,
              exclusion_reason,
              bridge_accounts!inner (
                bridge_account_id, bridge_item_id, name, iban, balance, account_type, bank_name, bridge_user_uuid, item_status, lifecycle_status
              )
            `)
            .in('company_id', scopedCompanyIds)
            .eq('status', 'excluded');
          if (excludedErr) {
            logError('Failed to load excluded accounts:', excludedErr);
          } else {
            const mapped: BridgeAccount[] = (excludedRows || []).map((row: any) => ({
              id: `${row.company_id}:${row.bridge_account_id}:excluded`,
              bridge_account_id: row.bridge_account_id,
              bridge_item_id: row.bridge_accounts?.bridge_item_id ?? row.bridge_account_id,
              name: row.bridge_accounts?.name ?? null,
              iban: row.bridge_accounts?.iban ?? null,
              balance: row.bridge_accounts?.balance === null || row.bridge_accounts?.balance === undefined
                ? null
                : Number(row.bridge_accounts.balance),
              account_type: row.bridge_accounts?.account_type ?? null,
              bank_name: row.bridge_accounts?.bank_name ?? null,
              bridge_user_uuid: row.bridge_accounts?.bridge_user_uuid ?? '',
              company_id: row.company_id,
              item_status: null,
              item_status_message: row.exclusion_reason ?? null,
            }));
            setExcludedAccounts(mapped);
          }
        } else {
          setExcludedAccounts([]);
        }

        // Build assignments map
        const assignmentMap = new Map<number, AccountAssignment>();
        bridgeAccounts.forEach(account => {
          assignmentMap.set(account.bridge_account_id, {
            bridge_account_id: account.bridge_account_id,
            company_id: account.company_id,
            is_enabled: true,
            status: 'active',
          });
        });
        setAssignments(assignmentMap);
      } catch (error) {
        logError('Failed to load accounts:', error);
        toast.error('Erreur lors du chargement des comptes');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOrgAdmin, currentCompany?.id, orgCompanyIds.join(',')]);

  // Réintègre un compte exclu (lève l'exclusion + réactive). Le trigger
  // DB exige que les champs d'exclusion soient explicitement remis à NULL,
  // pour empêcher toute réactivation accidentelle par la sync.
  const handleReintegrate = async (account: BridgeAccount) => {
    setReintegratingId(account.bridge_account_id);
    try {
      const { error } = await supabase
        .from('company_bridge_accounts')
        .update({
          status: 'active',
          excluded_at: null,
          excluded_by: null,
          exclusion_reason: null,
        })
        .eq('company_id', account.company_id)
        .eq('bridge_account_id', account.bridge_account_id);
      if (error) throw error;
      toast.success('Compte réintégré');
      setExcludedAccounts(prev => prev.filter(a => a.bridge_account_id !== account.bridge_account_id));
      // Recharge la vue
      window.location.reload();
    } catch (error) {
      logError('Reintegrate error:', error);
      toast.error('Impossible de réintégrer ce compte');
    } finally {
      setReintegratingId(null);
    }
  };

  // Résout les noms des sociétés référencées par les assignations qui ne sont pas
  // déjà connues (cas super-admin / impersonation : comptes assignés à d'autres orgs).
  useEffect(() => {
    const referencedIds = new Set<string>();
    assignments.forEach(a => {
      if (a.company_id) referencedIds.add(a.company_id);
    });
    const missing = Array.from(referencedIds).filter(id => !companyNameById.has(id));
    if (missing.length === 0) return;

    (async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', missing);
      if (error) {
        logError('Failed to resolve referenced companies:', error);
        return;
      }
      setResolvedCompanies(prev => {
        const next = new Map(prev);
        (data || []).forEach(c => next.set(c.id, c.name));
        return next;
      });
    })();
  }, [assignments, companyNameById]);

  // Auto-sync after Bridge connection (check localStorage flag)
  useEffect(() => {
    const pendingSync = localStorage.getItem('bridgePendingSync');
    if (pendingSync !== 'true') return;
    
    // Clear the flag immediately to prevent multiple syncs
    localStorage.removeItem('bridgePendingSync');
    
    const autoSync = async () => {
      const companiesWithBridge = allCompanies.filter(c => c.bridge_user_uuid);
      if (companiesWithBridge.length === 0) {
        return;
      } else {
        await runAutoSync(companiesWithBridge);
      }
    };
    
    autoSync();
  }, [allCompanies]);

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
      logError('Auto sync error:', error);
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

  const handleBankNameUpdate = async (bridgeItemId: number, newName: string) => {
    try {
      logDebug('Updating bank name:', { bridgeItemId, newName });
      
      const { data, error } = await supabase
        .from('bridge_accounts')
        .update({ bank_name: newName })
        .eq('bridge_item_id', bridgeItemId)
        .select();

      if (error) {
        logError('Supabase error:', error);
        throw error;
      }

      logDebug('Update result:', data);

      // Update local state - ensure we're creating new array reference
      setAccounts(prevAccounts => {
        const updatedAccounts = prevAccounts.map(account => 
          account.bridge_item_id === bridgeItemId 
            ? { ...account, bank_name: newName }
            : account
        );
        logDebug('Updated accounts state:', updatedAccounts.filter(a => a.bridge_item_id === bridgeItemId));
        return updatedAccounts;
      });

      toast.success('Nom de banque mis à jour');
    } catch (error) {
      logError('Error updating bank name:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Detect newly assigned companies (to trigger sync after save)
      const previousAssignedCompanies = new Set<string>();
      const newAssignedCompanies = new Set<string>();

      // Build "before" state from current DB assignments
      for (const account of accounts) {
        const oldAssignment = assignments.get(account.bridge_account_id);
        // We need to check what was loaded initially — but we only have current state
        // So we compare: accounts that NOW have a company but didn't before
      }

      // Only delete assignments for accounts we're managing within the current organization.
      const accountIds = accounts.map(a => a.bridge_account_id);
      const managedCompanyIds = allCompanies.map(c => c.id);

      // Fetch current DB assignments before deleting to detect changes
      const { data: currentDbAssignments } = await supabase
        .from('company_bridge_accounts')
        .select('bridge_account_id, company_id, status')
        .in('bridge_account_id', accountIds)
        .in('company_id', managedCompanyIds);

      const oldAssignmentMap = new Map<number, string>();
      for (const a of currentDbAssignments || []) {
        oldAssignmentMap.set(a.bridge_account_id, a.company_id);
      }

      const assignmentRows = Array.from(assignments.values()).flatMap(a => {
        const companyId = a.company_id || oldAssignmentMap.get(a.bridge_account_id);
        if (!companyId) return [];
        return [{
          company_id: companyId,
          bridge_account_id: a.bridge_account_id,
          status: a.is_enabled && a.company_id ? 'active' : 'excluded',
          excluded_at: a.is_enabled && a.company_id ? null : new Date().toISOString(),
          exclusion_reason: a.is_enabled && a.company_id ? null : 'Désactivé depuis les paramètres bancaires',
        }];
      });

      const desiredKeys = new Set(assignmentRows.map(a => `${a.company_id}:${a.bridge_account_id}`));
      for (const existing of currentDbAssignments || []) {
        const key = `${existing.company_id}:${existing.bridge_account_id}`;
        if (!desiredKeys.has(key) && existing.status !== 'excluded') {
          assignmentRows.push({
            company_id: existing.company_id,
            bridge_account_id: existing.bridge_account_id,
            status: 'excluded',
            excluded_at: new Date().toISOString(),
            exclusion_reason: 'Désactivé depuis les paramètres bancaires',
          });
        }
      }

      if (assignmentRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('company_bridge_accounts')
          .upsert(assignmentRows, { onConflict: 'company_id,bridge_account_id' });

        if (upsertError) throw upsertError;
      }

      const newAssignments = assignmentRows.filter(a => a.status === 'active');

      // Detect which companies gained new accounts
      for (const a of newAssignments) {
        const oldCompany = oldAssignmentMap.get(a.bridge_account_id);
        if (a.company_id && a.company_id !== oldCompany) {
          newAssignedCompanies.add(a.company_id);
        }
      }

      // Le trigger trg_recompute_on_cba_change met à jour companies.bank_balance
      // et bridge_accounts_count automatiquement à chaque changement d'assignation.
      // Pas d'écriture frontend pour préserver la source unique de vérité.

      toast.success('Configuration des comptes enregistrée');
      setHasChanges(false);
      refetchCompanies();

      // Trigger sync for companies that gained new accounts
      if (newAssignedCompanies.size > 0) {
        triggerSyncForCompanies(newAssignedCompanies);
      }
    } catch (error) {
      logError('Save error:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
    setIsSaving(false);
    }
  };

  const triggerSyncForCompanies = async (companyIds: Set<string>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const companiesToSync = allCompanies.filter(c => companyIds.has(c.id) && c.bridge_user_uuid);
      if (companiesToSync.length === 0) return;

      toast.info('Synchronisation des transactions en cours...');

      for (const company of companiesToSync) {
        const { data, error } = await supabase.functions.invoke('bridge-sync', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: {
            action: 'full-sync',
            bridge_user_uuid: company.bridge_user_uuid,
            company_id: company.id,
          },
        });

        if (error || !data?.success) {
          logError(`Sync error for ${company.name}:`, error || data?.error);
        } else {
          const inserted = data.inserted || 0;
          const updated = data.updated || 0;
          if (inserted > 0 || updated > 0) {
            toast.success(`${company.name} : ${inserted} nouvelles transactions synchronisées`);
          }
        }
      }
    } catch (error) {
      logError('Post-save sync error:', error);
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

      // Refetch companies in the current organization to get latest bridge_user_uuid state
      let freshCompaniesQuery = supabase
        .from('companies')
        .select('id, bridge_user_uuid')
        .is('deleted_at', null);

      if (currentOrganization?.id) {
        freshCompaniesQuery = freshCompaniesQuery.eq('organization_id', currentOrganization.id);
      }

      const { data: freshCompanies } = await freshCompaniesQuery;
      
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
        const targetCompanyId = freshCompanies?.[0]?.id || allCompanies[0]?.id;
        if (targetCompanyId) {
          await supabase
            .from('companies')
            .update({ bridge_user_uuid: bridgeUserUuid })
            .eq('id', targetCompanyId);
        }
      }

      // Build redirect URL - ALWAYS use current origin to preserve auth session
      // Using a different origin (like published URL) would lose the user's session
      const currentOrigin = window.location.origin;
      const redirectUrl = `${currentOrigin}/parametres?tab=accounts&bridge_callback=success`;
      logDebug('[Bridge] Redirect URL:', redirectUrl);

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
      logError('Bridge connect error:', error);
      toast.error('Erreur lors de la connexion Bridge');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnectBank = async (bridgeUserUuid: string, bridgeItemId: number) => {
    setIsConnecting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      // Build redirect URL - ALWAYS use current origin to preserve auth session
      const currentOrigin = window.location.origin;
      const redirectUrl = `${currentOrigin}/parametres?tab=accounts&bridge_callback=success`;

      // Create manage session (for reconnection)
      const { data: connectData, error: connectError } = await supabase.functions.invoke('bridge-connect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { 
          bridge_user_uuid: bridgeUserUuid,
          redirect_url: redirectUrl,
          item_id: bridgeItemId,
        },
      });

      if (connectError || !connectData?.success) {
        toast.error(connectData?.error || 'Erreur lors de la reconnexion');
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
      logError('Reconnect error:', error);
      toast.error('Erreur lors de la reconnexion');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFullSync = async (options?: { sinceDays?: number; label?: string }) => {
    const companiesWithBridgeConnection = allCompanies.filter(c => c.bridge_user_uuid);
    
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

      if (options?.label) toast.info(options.label);

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
            ...(options?.sinceDays ? { since_days: options.sinceDays } : {}),
          },
        });

        if (error) {
          logError(`Sync error for ${company.name}:`, error);
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
      logError('Full sync error:', error);
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeepHistorySync = () => handleFullSync({
    sinceDays: 730,
    label: 'Récupération de l\'historique complet (24 mois)... cela peut prendre 1 à 2 minutes.',
  });

  const formatBalance = (balance: number | null) => {
    if (balance === null) return '-';
    return balance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  const formatIban = (iban: string | null) => {
    if (!iban) return '';
    return '•••• ' + iban.slice(-4);
  };

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
  const hasAnyBridgeConnection = allCompanies.some(c => c.bridge_user_uuid);

  // For members: show a simpler empty state if no accounts assigned to their company
  if (displayedAccounts.length === 0) {
    // Member with no accounts assigned to their company
    if (!isOrgAdmin && currentCompany) {
      return (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              Comptes bancaires de {currentCompany.name}
            </CardTitle>
            <CardDescription>
              Comptes bancaires associés à votre société
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Landmark className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Aucun compte bancaire n'est assigné à cette société.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Contactez l'administrateur de votre organisation pour configurer les comptes.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Admin with no accounts at all
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleFullSync()}
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
              <Button
                variant="ghost"
                onClick={handleDeepHistorySync}
                disabled={isSyncing}
                className="gap-2"
                title="Récupère 24 mois d'historique depuis Bridge (plus long)"
              >
                Historique complet
              </Button>
            </div>
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

  // Member view: read-only display
  if (!isOrgAdmin && currentCompany) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Comptes bancaires de {currentCompany.name}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            Solde total : 
            <span className="font-semibold text-foreground">
              {formatBalance(totalDisplayedBalance)}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankAccountsListReadOnly
            accounts={displayedAccounts}
            currentCompanyName={currentCompany.name}
            formatBalance={formatBalance}
            formatIban={formatIban}
          />
        </CardContent>
      </Card>
    );
  }

  // Admin view: full control
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
            onClick={() => handleFullSync()}
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
          <Button
            variant="ghost"
            onClick={handleDeepHistorySync}
            disabled={isSyncing}
            className="gap-2"
            title="Récupère 24 mois d'historique depuis Bridge (plus long)"
          >
            Historique complet
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
          accounts={displayedAccounts}
          assignments={assignments}
          companies={allCompanies}
          companyNameById={companyNameById}
          onToggle={handleToggle}
          onCompanyChange={handleCompanyChange}
          formatBalance={formatBalance}
          formatIban={formatIban}
          onBankNameUpdate={handleBankNameUpdate}
          onReconnect={handleReconnectBank}
          isOrgAdmin={isOrgAdmin}
        />

        {hasChanges && (
          <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
            N'oubliez pas d'enregistrer vos modifications
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Read-only list for members
function BankAccountsListReadOnly({
  accounts,
  currentCompanyName,
  formatBalance,
  formatIban,
}: {
  accounts: BridgeAccount[];
  currentCompanyName: string;
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
        const bridgeItemId = group.accounts[0]?.bridge_item_id;
        
        return (
          <Collapsible 
            key={`${group.bankName}-${bridgeItemId}`} 
            open={isExpanded}
            onOpenChange={() => toggleBank(group.bankName)}
          >
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2 flex-1">
                <CollapsibleTrigger className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Landmark className="w-5 h-5 text-primary" />
                </CollapsibleTrigger>
                
                <span className="font-semibold text-foreground">
                  {group.bankName}
                </span>
                
                <Badge variant="secondary" className="text-xs ml-2">
                  {group.accounts.length} compte{group.accounts.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <span className="font-semibold text-foreground">
                {formatBalance(group.totalBalance)}
              </span>
            </div>
            
            <CollapsibleContent>
              <div className="mt-2 ml-4 space-y-2 border-l-2 border-muted pl-4">
                {group.accounts.map((account, index) => {
                  const displayName = account.name || 'Compte sans nom';

                  return (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card"
                    >
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

                      {/* Company badge (read-only) */}
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {currentCompanyName}
                      </Badge>
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

// Full admin list with editing capabilities
function BankAccountsList({
  accounts,
  assignments,
  companies,
  companyNameById,
  onToggle,
  onCompanyChange,
  formatBalance,
  formatIban,
  onBankNameUpdate,
  onReconnect,
  isOrgAdmin,
}: {
  accounts: BridgeAccount[];
  assignments: Map<number, AccountAssignment>;
  companies: { id: string; name: string }[];
  companyNameById: Map<string, string>;
  onToggle: (bridgeAccountId: number, enabled: boolean) => void;
  onCompanyChange: (bridgeAccountId: number, companyId: string) => void;
  formatBalance: (balance: number | null) => string;
  formatIban: (iban: string | null) => string;
  onBankNameUpdate: (bridgeItemId: number, newName: string) => Promise<void>;
  onReconnect: (bridgeUserUuid: string, bridgeItemId: number) => void;
  isOrgAdmin: boolean;
}) {
  const bankGroups = useMemo(() => groupAccountsByBank(accounts), [accounts]);
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(() => 
    new Set(bankGroups.map(g => g.bankName))
  );
  const [editingBankId, setEditingBankId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleStartEdit = (e: React.MouseEvent, group: BankGroup) => {
    e.stopPropagation();
    const firstAccount = group.accounts[0];
    if (firstAccount) {
      setEditingBankId(firstAccount.bridge_item_id);
      setEditingName(group.bankName);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSaveEdit = async () => {
    if (editingBankId && editingName.trim()) {
      await onBankNameUpdate(editingBankId, editingName.trim());
    }
    setEditingBankId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingBankId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="space-y-4">
      {bankGroups.map((group) => {
        const isExpanded = expandedBanks.has(group.bankName);
        const firstAccount = group.accounts[0];
        const bridgeItemId = firstAccount?.bridge_item_id;
        const isEditing = editingBankId === bridgeItemId;
        
        return (
          <Collapsible 
            key={`${group.bankName}-${bridgeItemId}`} 
            open={isExpanded}
            onOpenChange={() => !isEditing && toggleBank(group.bankName)}
          >
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2 flex-1">
                <CollapsibleTrigger className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Landmark className="w-5 h-5 text-primary" />
                </CollapsibleTrigger>
                
                {/* Editable bank name - aligned next to icon */}
                {isEditing ? (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Input
                      ref={inputRef}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSaveEdit}
                      className="h-7 w-40 text-sm font-semibold"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveEdit}>
                      <Check className="w-4 h-4 text-primary" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-2 group cursor-pointer hover:text-primary transition-colors"
                    onDoubleClick={(e) => isOrgAdmin && handleStartEdit(e, group)}
                    title={isOrgAdmin ? "Double-cliquez pour modifier" : undefined}
                  >
                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {group.bankName}
                    </span>
                    {isOrgAdmin && (
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                )}
                
                <Badge variant="secondary" className="text-xs ml-2">
                  {group.accounts.length} compte{group.accounts.length > 1 ? 's' : ''}
                </Badge>
                
                <StatusBadge status={group.itemStatus} message={group.itemStatusMessage} />
                
                {(group.itemStatus === 'needs_action' || group.itemStatus === 'error') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReconnect(group.bridgeUserUuid, group.bridgeItemId);
                    }}
                    className="gap-1 h-7 text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reconnecter
                  </Button>
                )}
              </div>
              <span className="font-semibold text-foreground">
                {formatBalance(group.totalBalance)}
              </span>
            </div>
            
            <CollapsibleContent>
              <div className="mt-2 ml-4 space-y-2 border-l-2 border-muted pl-4">
                {group.accounts.map((account, index) => {
                  const assignment = assignments.get(account.bridge_account_id);
                  const isEnabled = assignment?.is_enabled ?? false;
                  const companyId = assignment?.company_id || 'none';
                  
                  // Show full account name for clarity - don't truncate
                  const displayName = account.name || 'Compte sans nom';

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
                      {/* Toggle - only for admins */}
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
                      <div className="w-56">
                        <Select
                          value={companyId}
                          onValueChange={(value) => onCompanyChange(account.bridge_account_id, value)}
                        >
                          <SelectTrigger className="bg-background [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span]:min-w-0 [&>span]:truncate">
                            {companyId !== 'none' ? (
                              <>
                                <Building2 className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate whitespace-nowrap">
                                  {companyNameById.get(companyId) ?? 'Société inconnue'}
                                </span>
                              </>
                            ) : (
                              <SelectValue placeholder="Non assigné">
                                <span className="text-muted-foreground">Non assigné</span>
                              </SelectValue>
                            )}
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border z-50">
                            <SelectItem value="none">
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <X className="w-3 h-3" />
                                Non assigné
                              </span>
                            </SelectItem>
                            {companies.map((company) => (
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
