import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VariableExpense, VARIABLE_EXPENSE_CATEGORIES, useVariableExpenses } from '../hooks/useVariableExpenses';
import { useRevenueStreams } from '../hooks/useRevenueStreams';
import { VariableExpenseDialog } from '../dialogs/VariableExpenseDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Percent, Hash, Loader2, TrendingDown } from 'lucide-react';
import { DynamicIcon } from '@/components/ui/dynamic-icon';

export function VariableExpenseTable() {
  const { expenses, isLoading, deleteExpense } = useVariableExpenses();
  const { streams } = useRevenueStreams();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<VariableExpense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (expense: VariableExpense) => {
    setSelectedExpense(expense);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedExpense(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteExpense.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const getStreamName = (streamId: string | null) => {
    if (!streamId) return 'Tous les flux';
    const stream = streams.find(s => s.id === streamId);
    return stream?.name || 'Flux inconnu';
  };

  const formatValue = (expense: VariableExpense) => {
    if (expense.calculation_type === 'percentage') {
      return `${expense.percentage}%`;
    }
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(expense.unit_cost);
  };

  const formatVatRate = (rate: number) => {
    return `${(rate * 100).toFixed(1).replace('.0', '')}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Charges variables</h3>
          <p className="text-sm text-muted-foreground">
            Coûts proportionnels au chiffre d'affaires ou au volume
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingDown className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Aucune charge variable</CardTitle>
            <CardDescription className="text-center mb-4">
              Les charges variables sont des coûts qui évoluent avec votre activité (commissions, frais de livraison, etc.)
            </CardDescription>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une charge variable
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead>Flux lié</TableHead>
                <TableHead>TVA</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const category = VARIABLE_EXPENSE_CATEGORIES[expense.category as keyof typeof VARIABLE_EXPENSE_CATEGORIES];
                return (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.name}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className="flex items-center gap-1 w-fit"
                        style={{ borderColor: category?.color, color: category?.color }}
                      >
                        {category && <DynamicIcon name={category.icon} className="h-3 w-3" />}
                        {category?.label || expense.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {expense.calculation_type === 'percentage' ? (
                          <>
                            <Percent className="h-3 w-3" />
                            <span className="text-xs">% du CA</span>
                          </>
                        ) : (
                          <>
                            <Hash className="h-3 w-3" />
                            <span className="text-xs">€/unité</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatValue(expense)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getStreamName(expense.linked_revenue_stream_id)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs">{formatVatRate(expense.vat_rate)}</span>
                        {expense.is_vat_deductible && (
                          <span className="text-[10px] text-muted-foreground">déductible</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(expense)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(expense.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <VariableExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={selectedExpense}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette charge variable ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La charge sera définitivement supprimée.
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
    </div>
  );
}
