import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';

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
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user && !!currentCompany?.id,
  });

  // Auto-update overdue status
  const processedInvoices = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return invoices.map(invoice => {
      if (invoice.status === 'pending' && invoice.due_date < today) {
        return { ...invoice, status: 'overdue' as InvoiceStatus };
      }
      return invoice;
    });
  }, [invoices]);

  // Statistics
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

  // Create invoice
  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      if (!user || !currentCompany) throw new Error('Non authentifié');

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
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
        })
        .select()
        .single();

      if (error) throw error;
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Facture créée',
        description: 'La facture a été ajoutée avec succès.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la facture.',
        variant: 'destructive',
      });
      console.error('Create invoice error:', error);
    },
  });

  // Update invoice
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvoiceFormData> }) => {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Facture mise à jour',
        description: 'Les modifications ont été enregistrées.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la facture.',
        variant: 'destructive',
      });
      console.error('Update invoice error:', error);
    },
  });

  // Mark as paid
  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Facture payée',
        description: 'La facture a été marquée comme payée.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de marquer la facture comme payée.',
        variant: 'destructive',
      });
      console.error('Mark as paid error:', error);
    },
  });

  // Delete invoice
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Facture supprimée',
        description: 'La facture a été supprimée.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la facture.',
        variant: 'destructive',
      });
      console.error('Delete invoice error:', error);
    },
  });

  // Update category
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .update({
          category_id: categoryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la catégorie.',
        variant: 'destructive',
      });
      console.error('Update category error:', error);
    },
  });

  // Get unique partner names for autocomplete
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
