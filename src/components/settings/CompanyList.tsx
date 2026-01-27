import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Plus, Pencil, Trash2, Star, Landmark, Loader2, RefreshCw, Link } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompany, Company } from '@/hooks/useCompany';
import { CompanyDialog } from './CompanyDialog';
import { LinkBridgeDialog } from './LinkBridgeDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function CompanyList() {
  const { companies, isLoading, deleteCompany, updateCompany, refetch } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [syncingBridge, setSyncingBridge] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTargetCompany, setLinkTargetCompany] = useState<Company | null>(null);

  // Companies that already have Bridge connected (for linking)
  const companiesWithBridge = companies.filter(c => c.bridge_user_uuid);

  // Handle Bridge callback - auto-sync when returning from Bridge
  // Check both URL params (legacy) and localStorage for company ID
  useEffect(() => {
    const bridgeCallback = searchParams.get('bridge_callback');
    // Try URL param first, then localStorage
    const companyIdFromUrl = searchParams.get('company_id');
    const companyIdFromStorage = localStorage.getItem('bridgePendingCompanyId');
    const companyId = companyIdFromUrl || companyIdFromStorage;
    
    if (bridgeCallback === 'success' && companyId && companies.length > 0) {
      // Clear the query params and localStorage
      setSearchParams({});
      localStorage.removeItem('bridgePendingCompanyId');
      
      // Find the company and trigger sync
      const company = companies.find(c => c.id === companyId);
      if (company?.bridge_user_uuid) {
        toast.success('Connexion Bridge réussie ! Synchronisation en cours...');
        handleFullSync(company);
      }
    }
  }, [searchParams, companies]);

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCompany(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteCompany(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleSetDefault = async (company: Company) => {
    await updateCompany(company.id, { ...company, is_default: true });
  };

  const handleConnectBridge = async (company: Company) => {
    setSyncingBridge(company.id);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      // Check if company already has a Bridge user, if not create one
      let bridgeUserUuid = company.bridge_user_uuid;
      
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
        
        // Save the Bridge user UUID to the company
        await supabase
          .from('companies')
          .update({ bridge_user_uuid: bridgeUserUuid })
          .eq('id', company.id);
      }

      // Build redirect URL to return to settings after Bridge connection
      // Use simple base URL - company ID is stored in localStorage
      // Bridge whitelist typically requires exact URL match without query params
      const redirectUrl = `${window.location.origin}/parametres?bridge_callback=success`;

      // Create Connect session via bridge-connect function
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

      // IMPORTANT: open in the SAME TAB so the callback redirect lands back in the app
      // (opening in a popup/iframe can cause the app to be displayed inside Bridge UI instead
      // of navigating the main window).
      localStorage.setItem('bridgePendingCompanyId', company.id);
      toast.success('Redirection vers Bridge…', {
        description: 'Vous reviendrez automatiquement ici après la connexion.',
        duration: 6000,
      });

      // In Preview, the app runs inside an iframe; Bridge blocks being framed (X-Frame-Options/CSP),
      // which surfaces as "refused to connect / blocked".
      // So: if we are in an iframe, open Bridge in a new tab/window.
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
        // Published / non-iframe contexts: keep same-tab navigation so callback lands back in the app.
        window.location.assign(connectData.connect_url);
      }
      return;
      
      await refetch();
    } catch (error) {
      console.error('Bridge connect error:', error);
      toast.error('Erreur lors de la connexion Bridge');
    } finally {
      setSyncingBridge(null);
    }
  };

  const handleFullSync = async (company: Company) => {
    const bridgeUserUuid = company.bridge_user_uuid;
    if (!bridgeUserUuid) {
      toast.error('Connectez d\'abord Bridge pour cette société');
      return;
    }

    setSyncingBridge(company.id);
    
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
          company_id: company.id,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Erreur lors de la synchronisation Bridge');
        return;
      }

      const balance = data.totalBalance?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) || '0 €';
      toast.success(`${data.accounts} comptes • ${balance} • ${data.inserted} nouvelles transactions, ${data.updated} mises à jour`);
      
      await refetch();
    } catch (error) {
      console.error('Full sync error:', error);
      toast.error('Erreur lors de la synchronisation Bridge');
    } finally {
      setSyncingBridge(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Mes sociétés
            </CardTitle>
            <CardDescription>
              Gérez vos sociétés et leurs comptes Bridge
            </CardDescription>
          </div>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Ajouter une société
          </Button>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Aucune société
              </h3>
              <p className="text-muted-foreground mb-4">
                Créez votre première société pour commencer
              </p>
              <Button onClick={handleAdd} className="gap-2">
                <Plus className="w-4 h-4" />
                Créer une société
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {companies.map((company, index) => (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{company.name}</span>
                        {company.is_default && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="w-3 h-3" />
                            Par défaut
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {company.bridge_user_uuid ? (
                          <div className="flex items-center gap-1">
                            <Landmark className="w-3 h-3 text-primary" />
                            <span className="text-sm text-muted-foreground">
                              Bridge connecté
                              {company.bridge_accounts_count > 0 && (
                                <> • {company.bridge_accounts_count} compte{company.bridge_accounts_count > 1 ? 's' : ''}</>
                              )}
                            </span>
                          </div>
                        ) : null}
                        {company.bank_balance !== null && company.bank_balance !== undefined && (
                          <Badge variant="outline" className="text-xs font-normal">
                            Solde: {Number(company.bank_balance).toLocaleString('fr-FR')}€
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Bridge Connect/Sync buttons */}
                    {company.bridge_user_uuid ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnectBridge(company)}
                          disabled={syncingBridge === company.id}
                          className="gap-1.5"
                        >
                          {syncingBridge === company.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Ajouter banque
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleFullSync(company)}
                          disabled={syncingBridge === company.id}
                          className="gap-1.5"
                        >
                          {syncingBridge === company.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Sync Bridge
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnectBridge(company)}
                        disabled={syncingBridge === company.id}
                        className="gap-1.5"
                      >
                        {syncingBridge === company.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Landmark className="w-4 h-4" />
                        )}
                        Connecter Bridge
                      </Button>
                    )}
                    
                    {/* Link existing Bridge connection (only show if other companies have Bridge) */}
                    {!company.bridge_user_uuid && companiesWithBridge.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLinkTargetCompany(company);
                          setLinkDialogOpen(true);
                        }}
                        className="gap-1.5"
                      >
                        <Link className="w-4 h-4" />
                        Lier existant
                      </Button>
                    )}
                    
                    {!company.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(company)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(company)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(company.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        company={editingCompany}
      />

      <LinkBridgeDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        targetCompany={linkTargetCompany}
        companiesWithBridge={companiesWithBridge}
        onSuccess={refetch}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette société ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées à cette société
              (transactions, catégories, prévisions) seront dissociées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
