import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { useSuperAdminOrgStats, useDeleteOrganization } from '@/hooks/useSuperAdmin';
import { DeleteOrganizationDialog } from '@/components/superadmin/DeleteOrganizationDialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const planColors: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  pro: 'bg-primary/10 text-primary',
  business: 'bg-amber-500/10 text-amber-600',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600',
  trialing: 'bg-blue-500/10 text-blue-600',
  canceled: 'bg-red-500/10 text-red-600',
  past_due: 'bg-orange-500/10 text-orange-600',
};

export default function SuperAdminOrganizations() {
  const navigate = useNavigate();
  const { data: orgStats, isLoading } = useSuperAdminOrgStats();
  const deleteOrganization = useDeleteOrganization();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [demoFilter, setDemoFilter] = useState<string>('all');

  const handleDelete = async (orgId: string) => {
    await deleteOrganization.mutateAsync(orgId);
  };

  const filteredOrgs = orgStats?.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === 'all' || org.plan === planFilter;
    const matchesStatus = statusFilter === 'all' || org.subscription_status === statusFilter;
    const matchesDemo = demoFilter === 'all' || 
      (demoFilter === 'demo' && org.is_demo) || 
      (demoFilter === 'production' && !org.is_demo);
    return matchesSearch && matchesPlan && matchesStatus && matchesDemo;
  }) || [];

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organisations</h1>
          <p className="text-muted-foreground">
            Gérez toutes les organisations de la plateforme
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="trialing">Essai</SelectItem>
              <SelectItem value="canceled">Annulé</SelectItem>
              <SelectItem value="past_due">Impayé</SelectItem>
            </SelectContent>
          </Select>
          <Select value={demoFilter} onValueChange={setDemoFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="demo">Démo</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {filteredOrgs.length} organisation{filteredOrgs.length > 1 ? 's' : ''} trouvée{filteredOrgs.length > 1 ? 's' : ''}
        </p>

        {/* Organizations Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune organisation trouvée</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Membres</TableHead>
                  <TableHead className="text-center">Entreprises</TableHead>
                  <TableHead className="text-center">BP</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.map((org) => (
                  <TableRow key={org.organization_id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {org.is_demo && (
                          <Badge variant="secondary" className="bg-violet-500/10 text-violet-600">
                            DÉMO
                          </Badge>
                        )}
                        <Badge variant="secondary" className={planColors[org.plan] || ''}>
                          {org.plan}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[org.subscription_status] || ''}>
                        {org.subscription_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{org.member_count}</TableCell>
                    <TableCell className="text-center">{org.company_count}</TableCell>
                    <TableCell className="text-center">{org.bp_count}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(org.created_at), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => navigate(`/superadmin/organizations/${org.organization_id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DeleteOrganizationDialog
                            organization={org}
                            onDelete={handleDelete}
                            isDeleting={deleteOrganization.isPending}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
