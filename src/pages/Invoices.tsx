import { useState, useMemo } from 'react';
import { Plus, Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceStats } from '@/components/invoices/InvoiceStats';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { InvoiceDialog } from '@/components/invoices/InvoiceDialog';
import { ConnectorStatus } from '@/components/invoices/ConnectorStatus';
import { useInvoices, Invoice, InvoiceFormData } from '@/hooks/useInvoices';
import { useAccountingConnector } from '@/hooks/useAccountingConnector';
import { Skeleton } from '@/components/ui/skeleton';

type TabFilter = 'all' | 'receivable' | 'payable';
type StatusFilter = 'all' | 'pending' | 'overdue';

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
  } = useInvoices();

  const {
    config,
    isLoading: isConnectorLoading,
    isSyncing,
    isTesting,
    isSaving,
    syncInvoices,
    disconnectConnector,
    testOdooConnection,
    saveOdooCredentials,
    testPennylaneConnection,
    savePennylaneCredentials,
  } = useAccountingConnector();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      if (tabFilter !== 'all' && invoice.type !== tabFilter) return false;
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPartner = invoice.partner_name.toLowerCase().includes(query);
        const matchesNumber = invoice.invoice_number?.toLowerCase().includes(query);
        if (!matchesPartner && !matchesNumber) return false;
      }
      return true;
    });
  }, [invoices, tabFilter, statusFilter, searchQuery]);

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

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Créances & Dettes" 
        subtitle="Suivez vos factures clients et fournisseurs pour une prévision de trésorerie précise"
        actions={
          <div className="flex items-center gap-2">
            <ConnectorStatus
              config={config}
              isLoading={isConnectorLoading}
              isSyncing={isSyncing}
              isTesting={isTesting}
              isSaving={isSaving}
              onSync={syncInvoices}
              onDisconnect={disconnectConnector}
              onTestOdoo={testOdooConnection}
              onSaveOdoo={saveOdooCredentials}
              onTestPennylane={testPennylaneConnection}
              onSavePennylane={savePennylaneCredentials}
            />
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

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="overdue">Échues</SelectItem>
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
