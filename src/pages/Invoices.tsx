import { useState, useMemo } from 'react';
import { Plus, RefreshCw, Filter } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceStats } from '@/components/invoices/InvoiceStats';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { InvoiceDialog } from '@/components/invoices/InvoiceDialog';
import { useInvoices, Invoice, InvoiceFormData } from '@/hooks/useInvoices';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type TabFilter = 'all' | 'receivable' | 'payable';
type StatusFilter = 'all' | 'pending' | 'overdue' | 'paid';

export default function Invoices() {
  const { 
    invoices, 
    stats, 
    partnerNames,
    isLoading, 
    createInvoice, 
    updateInvoice,
    markAsPaid, 
    deleteInvoice,
    isCreating,
  } = useInvoices();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      if (tabFilter !== 'all' && invoice.type !== tabFilter) return false;
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
      return true;
    });
  }, [invoices, tabFilter, statusFilter]);

  const handleOpenDialog = (invoice?: Invoice) => {
    setEditingInvoice(invoice || null);
    setDialogOpen(true);
  };

  const handleSubmit = (data: InvoiceFormData) => {
    if (editingInvoice) {
      updateInvoice({ id: editingInvoice.id, data });
    } else {
      createInvoice(data);
    }
  };

  const handleSyncPennylane = async () => {
    if (!currentCompany?.id) return;
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pennylane-invoices-sync', {
        body: { company_id: currentCompany.id },
      });

      if (error) throw error;

      toast({
        title: 'Synchronisation terminée',
        description: data.message || `${data.created || 0} créées, ${data.updated || 0} mises à jour`,
      });
    } catch (error) {
      console.error('Pennylane sync error:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: 'Impossible de synchroniser avec Pennylane. Vérifiez votre clé API.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Créances & Dettes" 
        subtitle="Suivez vos factures clients et fournisseurs pour une prévision de trésorerie précise"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncPennylane}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Pennylane
            </Button>
            <Button size="sm" onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : (
        <InvoiceStats {...stats} />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={tabFilter} onValueChange={(v) => setTabFilter(v as TabFilter)}>
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="receivable">Créances clients</TabsTrigger>
            <TabsTrigger value="payable">Dettes fournisseurs</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="overdue">Échues</SelectItem>
              <SelectItem value="paid">Payées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <InvoiceTable
          invoices={filteredInvoices}
          onEdit={handleOpenDialog}
          onMarkAsPaid={markAsPaid}
          onDelete={deleteInvoice}
        />
      )}

      {/* Dialog */}
      <InvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoice={editingInvoice}
        onSubmit={handleSubmit}
        partnerSuggestions={partnerNames}
      />
    </div>
  );
}
