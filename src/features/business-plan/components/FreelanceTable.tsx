import { Edit, Trash2, Briefcase } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useBPPersonnel, BPPersonnel } from '@/hooks/useBPPersonnel';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FreelanceTableProps {
  onEdit: (personnel: BPPersonnel) => void;
}

export function FreelanceTable({ onEdit }: FreelanceTableProps) {
  const { freelancers, deletePersonnel, getFreelanceMonthlyCost, totalFreelanceCost, isLoading } = useBPPersonnel();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'MMM yyyy', { locale: fr });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (freelancers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mission</TableHead>
            <TableHead className="text-right">TJM</TableHead>
            <TableHead className="text-right">Jours/mois</TableHead>
            <TableHead className="text-right">Coût mensuel</TableHead>
            <TableHead>Début</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {freelancers.map((person) => {
            const monthlyCost = getFreelanceMonthlyCost(person);
            
            return (
              <TableRow key={person.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <Briefcase className="h-4 w-4 text-orange-500" />
                    </div>
                    <span className="font-medium">{person.position}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(person.daily_rate) || 0)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {person.estimated_days_per_month || 0} j
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatCurrency(monthlyCost)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(person.start_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {person.end_date ? formatDate(person.end_date) : '–'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(person)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deletePersonnel.mutate(person.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Summary */}
      <div className="flex justify-end gap-6 p-4 bg-muted/50 rounded-lg">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total prestations/mois</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalFreelanceCost)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total annuel</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalFreelanceCost * 12)}</p>
        </div>
      </div>
    </div>
  );
}
