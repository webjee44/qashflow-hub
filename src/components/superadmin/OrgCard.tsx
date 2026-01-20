import { Building2, Users, FileText, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface OrgCardProps {
  organization: {
    organization_id: string;
    name: string;
    slug: string;
    plan: string;
    subscription_status: string;
    owner_email?: string;
    created_at: string;
    member_count: number;
    company_count: number;
    bp_count: number;
    is_demo?: boolean;
  };
}

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

export function OrgCard({ organization }: OrgCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{organization.name}</h3>
              <p className="text-sm text-muted-foreground">
                {organization.owner_email || `@${organization.slug}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {organization.is_demo && (
              <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200 border-violet-300">
                DÉMO
              </Badge>
            )}
            <Badge className={planColors[organization.plan] || planColors.free}>
              {organization.plan}
            </Badge>
            <Badge className={statusColors[organization.subscription_status] || statusColors.trialing}>
              {organization.subscription_status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{organization.member_count} membres</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4" />
            <span>{organization.company_count} entreprises</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{organization.bp_count} BP</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>
              Créée le {format(new Date(organization.created_at), 'dd MMM yyyy', { locale: fr })}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/superadmin/organizations/${organization.organization_id}`)}
          >
            Voir détails
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
