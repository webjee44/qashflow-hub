import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Pencil, Trash2, Star, Landmark, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompany, Company } from '@/hooks/useCompany';
import { CompanyDialog } from './CompanyDialog';
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [connectingBridge, setConnectingBridge] = useState<string | null>(null);

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
    setConnectingBridge(company.id);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      // Check if company already has a Bridge user, if not create one
      let bridgeUserUuid = company.bridge_user_uuid;
      
      if (!bridgeUserUuid) {
        // Create Bridge user
        const { data: createData, error: createError } = await supabase.functions.invoke('bridge-sync', {
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

      // Create Connect session
      const { data: connectData, error: connectError } = await supabase.functions.invoke('bridge-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { 
          action: 'create-connect-session',
          bridge_user_uuid: bridgeUserUuid,
        },
      });

      if (connectError || !connectData?.success) {
        toast.error(connectData?.error || 'Erreur lors de la création de la session Bridge');
        return;
      }

      // Open Bridge Connect in a new window
      const popup = window.open(connectData.connect_url, '_blank', 'width=600,height=800');
      
      if (!popup) {
        // Popup blocked - show URL to user
        toast.error('Popup bloquée. Cliquez sur le lien pour ouvrir Bridge Connect.', {
          description: 'Autorisez les popups pour ce site',
          action: {
            label: 'Ouvrir Bridge',
            onClick: () => window.open(connectData.connect_url, '_blank'),
          },
          duration: 10000,
        });
      } else {
        toast.success('Fenêtre Bridge Connect ouverte !', {
          description: '1. Sélectionnez votre banque\n2. Connectez-vous avec vos identifiants\n3. Revenez ici et cliquez "Sync Bridge"',
          duration: 15000,
        });
      }
      
      await refetch();
    } catch (error) {
      console.error('Bridge connect error:', error);
      toast.error('Erreur lors de la connexion Bridge');
    } finally {
      setConnectingBridge(null);
    }
  };

  const handleSyncBridgeAccounts = async (company: Company) => {
    const bridgeUserUuid = company.bridge_user_uuid;
    if (!bridgeUserUuid) {
      toast.error('Connectez d\'abord Bridge pour cette société');
      return;
    }

    setConnectingBridge(company.id);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      const { data, error } = await supabase.functions.invoke('bridge-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { 
          action: 'get-accounts',
          bridge_user_uuid: bridgeUserUuid,
          company_id: company.id,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Erreur lors de la synchronisation Bridge');
        return;
      }

      toast.success(`${data.accounts_count} comptes synchronisés. Solde total: ${data.total_balance.toLocaleString('fr-FR')}€`);
      await refetch();
    } catch (error) {
      console.error('Bridge sync error:', error);
      toast.error('Erreur lors de la synchronisation Bridge');
    } finally {
      setConnectingBridge(null);
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
                            <Landmark className="w-3 h-3 text-blue-500" />
                            <span className="text-sm text-muted-foreground">Bridge connecté</span>
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
                          disabled={connectingBridge === company.id}
                          className="gap-1.5"
                        >
                          {connectingBridge === company.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Ajouter banque
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncBridgeAccounts(company)}
                          disabled={connectingBridge === company.id}
                          className="gap-1.5"
                        >
                          {connectingBridge === company.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Landmark className="w-4 h-4" />
                          )}
                          Sync Bridge
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnectBridge(company)}
                        disabled={connectingBridge === company.id}
                        className="gap-1.5"
                      >
                        {connectingBridge === company.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Landmark className="w-4 h-4" />
                        )}
                        Connecter Bridge
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
