import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Users, FileText, Calendar, CreditCard, UserCog, Loader2, ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { useSuperAdminOrgStats } from '@/hooks/useSuperAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CompanyMembersManager } from '@/components/superadmin/CompanyMembersManager';
import { OrganizationMembersSection } from '@/components/superadmin/OrganizationMembersSection';

const planColors: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  business: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  trialing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  past_due: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export default function SuperAdminOrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: orgStats, isLoading } = useSuperAdminOrgStats();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [companiesOpen, setCompaniesOpen] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Update org name mutation
  const updateOrgName = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from('organizations')
        .update({ name: newName.trim() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-org-stats'] });
      toast.success('Nom mis à jour');
      setIsEditingName(false);
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleStartEdit = () => {
    if (organization) {
      setEditedName(organization.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = () => {
    if (editedName.trim() && editedName.trim() !== organization?.name) {
      updateOrgName.mutate(editedName);
    } else {
      setIsEditingName(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const organization = orgStats?.find((org) => org.organization_id === id);

  // Fetch companies for this organization using superadmin RPC function
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['superadmin-org-companies', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_superadmin_org_companies', {
        _org_id: id
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch owner email
  const { data: ownerEmail } = useQuery({
    queryKey: ['user-email', organization?.owner_id],
    queryFn: async () => {
      if (!organization?.owner_id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', organization.owner_id)
        .single();
      // Fallback: get from auth if needed
      return data?.full_name || 'Propriétaire';
    },
    enabled: !!organization?.owner_id,
  });

  const handleImpersonate = async () => {
    if (!organization?.owner_id) {
      toast.error("Aucun propriétaire trouvé pour cette organisation");
      return;
    }

    setIsImpersonating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { targetUserId: organization.owner_id },
      });

      if (error) {
        console.error('Impersonation error:', error);
        toast.error("Erreur lors de l'impersonation");
        return;
      }

      if (data?.impersonationUrl) {
        toast.success(`Ouverture de la session de ${data.targetEmail}...`);
        // Open in new tab to preserve superadmin session
        window.open(data.impersonationUrl, '_blank');
      } else {
        toast.error("Aucun lien d'impersonation reçu");
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error("Erreur inattendue");
    } finally {
      setIsImpersonating(false);
    }
  };

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64" />
        </div>
      </SuperAdminLayout>
    );
  }

  if (!organization) {
    return (
      <SuperAdminLayout>
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Organisation non trouvée</h2>
          <p className="text-muted-foreground mb-4">
            Cette organisation n'existe pas ou a été supprimée.
          </p>
          <Button variant="outline" onClick={() => navigate('/superadmin/organizations')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la liste
          </Button>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSaveName}
                    className="text-2xl font-bold h-10 w-80"
                    disabled={updateOrgName.isPending}
                  />
                  {updateOrgName.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              ) : (
                <h1 
                  className="text-3xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
                  onClick={handleStartEdit}
                  title="Cliquer pour modifier"
                >
                  {organization.name}
                  <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </h1>
              )}
              <Badge className={planColors[organization.plan] || planColors.free}>
                {organization.plan}
              </Badge>
              <Badge className={statusColors[organization.subscription_status] || statusColors.trialing}>
                {organization.subscription_status}
              </Badge>
            </div>
            <p className="text-muted-foreground">@{organization.slug}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{organization.member_count}</p>
                  <p className="text-sm text-muted-foreground">
                    Membres / {organization.max_members}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{organization.company_count}</p>
                  <p className="text-sm text-muted-foreground">
                    Entreprises / {organization.max_companies}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{organization.bp_count}</p>
                  <p className="text-sm text-muted-foreground">Business Plans</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-lg font-bold">
                    {format(new Date(organization.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-sm text-muted-foreground">Date de création</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Abonnement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium capitalize">{organization.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statut</span>
                <span className="font-medium capitalize">{organization.subscription_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Membres max</span>
                <span className="font-medium">{organization.max_members}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entreprises max</span>
                <span className="font-medium">{organization.max_companies}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleImpersonate}
                disabled={isImpersonating}
              >
                {isImpersonating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserCog className="w-4 h-4 mr-2" />
                )}
                Se connecter en tant que propriétaire
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Organization Members Section */}
        <OrganizationMembersSection organizationId={id!} />

        {/* Company Members Management */}
        <Collapsible open={companiesOpen} onOpenChange={setCompaniesOpen}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div>
                  <CardTitle className="flex items-center gap-2 text-left">
                    <Building2 className="w-5 h-5" />
                    Gestion des accès par société
                  </CardTitle>
                  <CardDescription className="text-left mt-1">
                    Ajouter ou retirer des utilisateurs sur chaque société
                  </CardDescription>
                </div>
                {companiesOpen ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {isLoadingCompanies ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                  </div>
                ) : companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucune société dans cette organisation
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {companies.map((company) => (
                      <CompanyMembersManager 
                        key={company.id} 
                        company={company}
                        ownerEmail={ownerEmail || undefined}
                        organizationId={id}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </SuperAdminLayout>
  );
}
