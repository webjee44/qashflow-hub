import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';
import { logError } from '@/lib/logger';
import { invoiceApi } from '../api/invoiceApi';

export type InvoiceType = 'receivable' | 'payable';
export type InvoiceStatus = 'pending' | 'paid' | 'overdue';
export type InvoiceSource = 'manual' | 'pennylane' | 'odoo';

export interface Invoice {
  id: string;
  user_id: string;
  company_id: string | null;
  type: InvoiceType;
  partner_name: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string;
  amount_ht: number;
  amount_ttc: number;
  vat_amount: number;
  status: InvoiceStatus;
  paid_at: string | null;
  transaction_id: string | null;
  category_id: string | null;
  source: InvoiceSource;
  external_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFormData {
  type: InvoiceType;
  partner_name: string;
  invoice_number?: string;
  invoice_date: string;
  due_date: string;
  amount_ht: number;
  amount_ttc: number;
  vat_amount: number;
  category_id?: string;
  notes?: string;
}

export function useInvoices() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['invoices', currentCompany?.id];

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => invoiceApi.getByCompany(currentCompany!.id),
    enabled: !!user && !!currentCompany?.id,
    select: (data) => data as Invoice[],
  });

  const processedInvoices = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return invoices.map(invoice => {
      if (invoice.status === 'pending' && invoice.due_date < today) {
        return { ...invoice, status: 'overdue' as InvoiceStatus };
      }
      return invoice;
    });
  }, [invoices]);

  const stats = useMemo(() => {
    const pendingReceivables = processedInvoices
      .filter(i => i.type === 'receivable' && i.status !== 'paid')
      .reduce((sum, i) => sum + Number(i.amount_ttc), 0);

    const pendingPayables = processedInvoices
      .filter(i => i.type === 'payable' && i.status !== 'paid')
      .reduce((sum, i) => sum + Number(i.amount_ttc), 0);

    const overdueReceivables = processedInvoices
      .filter(i => i.type === 'receivable' && i.status === 'overdue')
      .reduce((sum, i) => sum + Number(i.amount_ttc), 0);

    const overduePayables = processedInvoices
      .filter(i => i.type === 'payable' && i.status === 'overdue')
      .reduce((sum, i) => sum + Number(i.amount_ttc), 0);

    return {
      pendingReceivables,
      pendingPayables,
      overdueReceivables,
      overduePayables,
      netPosition: pendingReceivables - pendingPayables,
    };
  }, [processedInvoices]);

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      if (!user || !currentCompany) throw new Error('Non authentifié');

      return invoiceApi.create({
        user_id: user.id,
        company_id: currentCompany.id,
        type: data.type,
        partner_name: data.partner_name,
        invoice_number: data.invoice_number || null,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        amount_ht: data.amount_ht,
        amount_ttc: data.amount_ttc,
        vat_amount: data.vat_amount,
        category_id: data.category_id || null,
        notes: data.notes || null,
        source: 'manual',
        status: 'pending',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Facture créée', description: 'La facture a été ajoutée avec succès.' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: 'Impossible de créer la facture.', variant: 'destructive' });
      logError('Create invoice error:', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvoiceFormData> }) => {
      return invoiceApi.update(id, data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Facture mise à jour', description: 'Les modifications ont été enregistrées.' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour la facture.', variant: 'destructive' });
      logError('Update invoice error:', error);
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.markAsPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Facture payée', description: 'La facture a été marquée comme payée.' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: 'Impossible de marquer la facture comme payée.', variant: 'destructive' });
      logError('Mark as paid error:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Facture supprimée', description: 'La facture a été supprimée.' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: 'Impossible de supprimer la facture.', variant: 'destructive' });
      logError('Delete invoice error:', error);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      if (!currentCompany) throw new Error('No company selected');

      const invoice = processedInvoices.find(i => i.id === id);
      if (!invoice) throw new Error('Invoice not found');

      const updatedInvoice = await invoiceApi.updateCategory(id, categoryId);

      if (categoryId) {
        try {
          await invoiceApi.upsertPartnerMapping(currentCompany.id, currentCompany.user_id, invoice.partner_name, categoryId);
        } catch (e) {
          logError('Mapping upsert error:', e);
        }
        try {
          await invoiceApi.bulkUpdateCategoryByPartner(currentCompany.id, invoice.partner_name, categoryId);
        } catch (e) {
          logError('Bulk category update error:', e);
        }
      } else {
        try {
          await invoiceApi.deletePartnerMapping(currentCompany.id, invoice.partner_name);
        } catch (e) {
          logError('Mapping delete error:', e);
        }
      }

      return updatedInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour la catégorie.', variant: 'destructive' });
      logError('Update category error:', error);
    },
  });

  const partnerNames = useMemo(() => {
    const names = new Set(invoices.map(i => i.partner_name));
    return Array.from(names).sort();
  }, [invoices]);

  return {
    invoices: processedInvoices,
    stats,
    partnerNames,
    isLoading,
    error,
    createInvoice: createMutation.mutate,
    updateInvoice: updateMutation.mutate,
    markAsPaid: markAsPaidMutation.mutate,
    deleteInvoice: deleteMutation.mutate,
    updateCategory: (id: string, categoryId: string | null) =>
      updateCategoryMutation.mutate({ id, categoryId }),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
