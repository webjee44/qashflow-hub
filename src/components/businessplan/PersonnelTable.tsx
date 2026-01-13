import { Edit, Trash2, User } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { usePersonnel, Personnel } from '@/hooks/usePersonnel';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PersonnelTableProps {
  onEdit: (personnel: Personnel) => void;
}

export function PersonnelTable({ onEdit }: PersonnelTableProps) {
  const { personnel, deletePersonnel, getTotalCost, isLoading } = usePersonnel();

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

  const totalGrossSalaries = personnel.reduce((sum, p) => sum + Number(p.gross_salary), 0);
  const totalCharges = personnel.reduce((sum, p) => sum + (Number(p.gross_salary) * Number(p.employer_charges_rate)), 0);
  const totalCost = totalGrossSalaries + totalCharges;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (personnel.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Poste</TableHead>
            <TableHead className="text-right">Salaire brut</TableHead>
            <TableHead className="text-right">Charges</TableHead>
            <TableHead className="text-right">Coût total</TableHead>
            <TableHead>Début</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {personnel.map((person) => {
            const charges = Number(person.gross_salary) * Number(person.employer_charges_rate);
            const total = getTotalCost(person);
            
            return (
              <TableRow key={person.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{person.position}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(person.gross_salary))}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(charges)}
                  <span className="text-xs ml-1">({(Number(person.employer_charges_rate) * 100).toFixed(0)}%)</span>
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatCurrency(total)}
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
          <p className="text-sm text-muted-foreground">Salaires bruts</p>
          <p className="text-lg font-semibold">{formatCurrency(totalGrossSalaries)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Charges patronales</p>
          <p className="text-lg font-semibold">{formatCurrency(totalCharges)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Coût total mensuel</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalCost)}</p>
        </div>
      </div>
    </div>
  );
}
