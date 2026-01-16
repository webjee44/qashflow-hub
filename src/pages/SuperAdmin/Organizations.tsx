import { useState } from 'react';
import { Search, Building2 } from 'lucide-react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { OrgCard } from '@/components/superadmin/OrgCard';
import { useSuperAdminOrgStats } from '@/hooks/useSuperAdmin';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SuperAdminOrganizations() {
  const { data: orgStats, isLoading } = useSuperAdminOrgStats();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredOrgs = orgStats?.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === 'all' || org.plan === planFilter;
    const matchesStatus = statusFilter === 'all' || org.subscription_status === statusFilter;
    return matchesSearch && matchesPlan && matchesStatus;
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
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {filteredOrgs.length} organisation{filteredOrgs.length > 1 ? 's' : ''} trouvée{filteredOrgs.length > 1 ? 's' : ''}
        </p>

        {/* Organizations Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune organisation trouvée</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredOrgs.map((org) => (
              <OrgCard key={org.organization_id} organization={org} />
            ))}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
