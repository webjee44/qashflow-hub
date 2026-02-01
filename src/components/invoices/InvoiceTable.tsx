import { useState } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MoreHorizontal, Edit, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/hooks/useInvoices';

interface InvoiceTableProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onMarkAsPaid: (id: string) => void;
  onDelete: (id: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

function getStatusBadge(status: string, dueDate: string) {
  const today = new Date();
  const due = parseISO(dueDate);
  const daysUntilDue = differenceInDays(due, today);

  if (status === 'paid') {
    return <Badge className="bg-success/10 text-success border-0">Payée</Badge>;
  }
  
  if (status === 'overdue' || daysUntilDue < 0) {
    return (
      <Badge className="bg-destructive/10 text-destructive border-0 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Échue
      </Badge>
    );
  }
  
  if (daysUntilDue <= 7) {
    return <Badge className="bg-warning/10 text-warning border-0">Bientôt échue</Badge>;
  }
  
  return <Badge className="bg-muted text-muted-foreground border-0">En attente</Badge>;
}

function getDueDateDisplay(dueDate: string) {
  const today = new Date();
  const due = parseISO(dueDate);
  const daysUntilDue = differenceInDays(due, today);

  const formattedDate = format(due, 'd MMM yyyy', { locale: fr });

  if (daysUntilDue < 0) {
    return (
      <span className="text-destructive font-medium">
        {formattedDate} ({Math.abs(daysUntilDue)}j de retard)
      </span>
    );
  }
  
  if (daysUntilDue === 0) {
    return <span className="text-warning font-medium">{formattedDate} (aujourd'hui)</span>;
  }
  
  if (daysUntilDue <= 7) {
    return <span className="text-warning">{formattedDate} (dans {daysUntilDue}j)</span>;
  }
  
  return <span>{formattedDate}</span>;
}

export function InvoiceTable({ invoices, onEdit, onMarkAsPaid, onDelete }: InvoiceTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">Aucune facture</h3>
        <p className="text-muted-foreground text-sm">
          Ajoutez votre première facture pour commencer à suivre vos créances.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Partenaire</TableHead>
              <TableHead>N° Facture</TableHead>
              <TableHead className="text-right">Montant TTC</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className="group">
                <TableCell className="font-medium">{invoice.partner_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.invoice_number || '-'}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-medium",
                  invoice.type === 'receivable' ? 'text-success' : 'text-destructive'
                )}>
                  {invoice.type === 'receivable' ? '+' : '-'}
                  {formatCurrency(Number(invoice.amount_ttc))}
                </TableCell>
                <TableCell>{getDueDateDisplay(invoice.due_date)}</TableCell>
                <TableCell>{getStatusBadge(invoice.status, invoice.due_date)}</TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground capitalize">
                    {invoice.source}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(invoice)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      {invoice.status !== 'paid' && (
                        <DropdownMenuItem onClick={() => onMarkAsPaid(invoice.id)}>
                          <Check className="h-4 w-4 mr-2" />
                          Marquer payée
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => setDeleteId(invoice.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La facture sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDelete(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
