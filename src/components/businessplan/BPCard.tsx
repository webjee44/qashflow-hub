import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Eye, 
  Download, 
  Pencil, 
  Copy, 
  Trash2, 
  Calendar,
  TrendingUp,
  FileText
} from 'lucide-react';
import { BusinessPlan } from '@/hooks/useBusinessPlans';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BPCardProps {
  businessPlan: BusinessPlan;
  onView: (bp: BusinessPlan) => void;
  onEdit: (bp: BusinessPlan) => void;
  onDuplicate: (bp: BusinessPlan) => void;
  onDelete: (bp: BusinessPlan) => void;
  onDownload: (bp: BusinessPlan) => void;
}

export function BPCard({ businessPlan, onView, onEdit, onDuplicate, onDelete, onDownload }: BPCardProps) {
  const isFinalized = businessPlan.status === 'finalized';

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{businessPlan.name}</CardTitle>
            </div>
            {businessPlan.description && (
              <CardDescription className="line-clamp-2">
                {businessPlan.description}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(businessPlan)}>
                <Eye className="h-4 w-4 mr-2" />
                Aperçu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload(businessPlan)}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(businessPlan)}>
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(businessPlan)}>
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(businessPlan)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {businessPlan.bp_start_date 
              ? format(new Date(businessPlan.bp_start_date), 'MMM yyyy', { locale: fr })
              : 'Non défini'}
          </div>
          <span>•</span>
          <span>{businessPlan.bp_years} ans</span>
          <span>•</span>
          <Badge variant={isFinalized ? 'default' : 'secondary'}>
            {isFinalized ? 'Finalisé' : 'Brouillon'}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 py-3 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">CA An 1</p>
            <p className="font-semibold text-green-600">-</p>
          </div>
          <div className="text-center border-x">
            <p className="text-xs text-muted-foreground mb-1">Résultat</p>
            <p className="font-semibold">-</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Rentabilité</p>
            <p className="font-semibold text-primary">-</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={() => onView(businessPlan)}
          >
            <Eye className="h-4 w-4" />
            Aperçu
          </Button>
          <Button 
            className="flex-1 gap-2"
            onClick={() => onDownload(businessPlan)}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
