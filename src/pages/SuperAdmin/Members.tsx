import { useState } from 'react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { useSuperAdminAllMembers } from '@/hooks/useSuperAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, UserCog, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Organization {
  org_id: string;
  org_name: string;
  role: string;
}

interface Company {
  company_id: string;
  company_name: string;
  access_type: string;
}

interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  organizations: Organization[];
  companies: Company[];
}

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'owner':
      return 'default';
    case 'admin':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'owner':
      return 'Proprio';
    case 'admin':
      return 'Admin';
    case 'member':
      return 'Membre';
    case 'viewer':
      return 'Lecteur';
    default:
      return role;
  }
};

export default function SuperAdminMembers() {
  const { data: members, isLoading } = useSuperAdminAllMembers();
  const [search, setSearch] = useState('');
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const filteredMembers = (members as Member[] | undefined)?.filter((member) => {
    const searchLower = search.toLowerCase();
    return (
      member.email?.toLowerCase().includes(searchLower) ||
      member.full_name?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const handleImpersonate = async (userId: string) => {
    setImpersonating(userId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { targetUserId: userId },
      });

      if (error) throw error;

      if (data?.impersonationUrl) {
        window.open(data.impersonationUrl, '_blank');
        toast.success('Session d\'usurpation ouverte dans un nouvel onglet');
      }
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setImpersonating(null);
    }
  };

  const renderOrganizations = (orgs: Organization[]) => {
    if (!orgs || orgs.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }

    const visible = orgs.slice(0, 2);
    const remaining = orgs.length - 2;

    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((org) => (
          <Tooltip key={org.org_id}>
            <TooltipTrigger asChild>
              <Badge variant={getRoleBadgeVariant(org.role)} className="text-xs max-w-[120px] truncate">
                {org.org_name}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{org.org_name} ({getRoleLabel(org.role)})</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                +{remaining}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {orgs.slice(2).map((org) => (
                  <p key={org.org_id}>{org.org_name} ({getRoleLabel(org.role)})</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  const renderCompanies = (companies: Company[]) => {
    if (!companies || companies.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }

    const visible = companies.slice(0, 2);
    const remaining = companies.length - 2;

    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((company) => (
          <Tooltip key={company.company_id}>
            <TooltipTrigger asChild>
              <Badge 
                variant={company.access_type === 'owner' ? 'default' : 'outline'} 
                className="text-xs max-w-[120px] truncate"
              >
                {company.company_name}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{company.company_name} ({company.access_type === 'owner' ? 'Propriétaire' : 'Membre'})</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                +{remaining}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {companies.slice(2).map((company) => (
                  <p key={company.company_id}>
                    {company.company_name} ({company.access_type === 'owner' ? 'Propriétaire' : 'Membre'})
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Membres</h1>
              <p className="text-muted-foreground">
                Vue cumulative de tous les utilisateurs
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {filteredMembers.length} membre{filteredMembers.length > 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par email ou prénom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Organisations</TableHead>
                  <TableHead>Sociétés</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="w-[60px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun membre trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        {member.full_name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{renderOrganizations(member.organizations)}</TableCell>
                      <TableCell>{renderCompanies(member.companies)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(member.created_at), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleImpersonate(member.user_id)}
                              disabled={impersonating === member.user_id}
                            >
                              {impersonating === member.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserCog className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Se connecter à la place</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
