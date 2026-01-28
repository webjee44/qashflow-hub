import { Edit, Trash2, User, GraduationCap, Gift, DoorOpen } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBPPersonnel, BPPersonnel, CONTRACT_TYPES, DEPARTURE_TYPES } from '@/hooks/useBPPersonnel';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BPBonus, BONUS_TYPES } from '@/services/bonusService';
import { calculateSeveranceEmployerCost } from '@/lib/french-rates';

interface PersonnelTableProps {
  onEdit: (personnel: BPPersonnel) => void;
  bonuses?: BPBonus[];
}

export function PersonnelTable({ onEdit, bonuses = [] }: PersonnelTableProps) {
  const { employees, deletePersonnel, getEmployeeMonthlyCost, totalEmployeeCost, isLoading } = useBPPersonnel();

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

  // Calculer le total des primes par salarié
  const getBonusesForPerson = (personnelId: string) => {
    return bonuses.filter(b => b.personnel_id === personnelId);
  };

  const getTotalBonusesForPerson = (personnelId: string) => {
    return getBonusesForPerson(personnelId).reduce((sum, b) => sum + b.amount, 0);
  };

  // Mutuelle forfaitaire (150€/mois par défaut si non importée)
  const MUTUELLE_FORFAIT = 150;
  
  const totalGrossSalaries = employees.reduce((sum, p) => sum + Number(p.gross_salary), 0);
  // Charges proportionnelles (sans mutuelle)
  const totalProportionalCharges = employees.reduce((sum, p) => sum + (Number(p.gross_salary) * Number(p.employer_charges_rate)), 0);
  // Mutuelle forfaitaire par salarié
  const totalMutuelle = employees.reduce((sum, p) => sum + (p.mutuelle_employer_amount ?? MUTUELLE_FORFAIT), 0);
  // Total des charges = proportionnelles + mutuelle
  const totalCharges = totalProportionalCharges + totalMutuelle;
  const totalBonuses = bonuses.reduce((sum, b) => sum + b.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (employees.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Nom / Poste</TableHead>
            <TableHead>Contrat</TableHead>
            <TableHead className="text-right">Salaire brut</TableHead>
            <TableHead className="text-right">Charges</TableHead>
            <TableHead className="text-right">Primes</TableHead>
            <TableHead className="text-right">Coût total</TableHead>
            <TableHead>Début</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((person) => {
            // Charges proportionnelles (sans mutuelle)
            const proportionalCharges = Number(person.gross_salary) * Number(person.employer_charges_rate);
            // Mutuelle forfaitaire
            const mutuelle = person.mutuelle_employer_amount ?? MUTUELLE_FORFAIT;
            // Total des charges
            const charges = proportionalCharges + mutuelle;
            const total = getEmployeeMonthlyCost(person);
            const contractInfo = CONTRACT_TYPES[person.contract_type as keyof typeof CONTRACT_TYPES];
            const isIntern = person.worker_type === 'intern' || person.contract_type === 'stage';
            const personBonuses = getBonusesForPerson(person.id);
            const totalBonusForPerson = getTotalBonusesForPerson(person.id);
            
            return (
              <TableRow key={person.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isIntern ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                      {isIntern ? (
                        <GraduationCap className="h-4 w-4 text-amber-500" />
                      ) : (
                        <User className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      {person.name && (
                        <p className="font-semibold text-base truncate">{person.name}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={person.name ? "text-sm text-muted-foreground" : "font-medium"}>{person.position}</span>
                        {person.is_executive && (
                          <Badge variant="secondary" className="text-xs">Cadre</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {contractInfo?.label || person.contract_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(person.gross_salary))}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(charges)}
                  <span className="text-xs ml-1">({(Number(person.employer_charges_rate) * 100).toFixed(0)}%)</span>
                </TableCell>
                <TableCell className="text-right">
                  {personBonuses.length > 0 ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center gap-1 cursor-help">
                            <Gift className="h-3 w-3 text-emerald-500" />
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">
                              {formatCurrency(totalBonusForPerson)}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            {personBonuses.map((bonus) => (
                              <div key={bonus.id} className="flex justify-between gap-4 text-sm">
                                <span>{BONUS_TYPES[bonus.bonus_type as keyof typeof BONUS_TYPES]?.label || bonus.bonus_type}</span>
                                <span className="font-medium">{formatCurrency(bonus.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatCurrency(total)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(person.start_date)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">
                      {person.end_date ? formatDate(person.end_date) : '–'}
                    </span>
                    {person.departure_type && person.end_date && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Badge 
                                variant="outline" 
                                className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border-amber-200"
                              >
                                <DoorOpen className="h-3 w-3 mr-1" />
                                {DEPARTURE_TYPES[person.departure_type]?.label.split(' ')[0] || 'Départ'}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-sm">
                              <p className="font-medium">{DEPARTURE_TYPES[person.departure_type]?.label}</p>
                              {person.severance_amount && (
                                <>
                                  <p className="text-muted-foreground">
                                    Indemnité: {formatCurrency(Number(person.severance_amount))}
                                  </p>
                                  <p className="text-muted-foreground">
                                    Coût total: {formatCurrency(
                                      calculateSeveranceEmployerCost(
                                        Number(person.severance_amount),
                                        DEPARTURE_TYPES[person.departure_type]?.employerContributionRate
                                      ).totalCost
                                    )}
                                  </p>
                                </>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
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
        {totalBonuses > 0 && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Primes annuelles</p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalBonuses)}</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Coût total mensuel</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalEmployeeCost)}</p>
        </div>
      </div>
    </div>
  );
}