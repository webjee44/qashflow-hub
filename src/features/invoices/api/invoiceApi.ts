import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { invoiceSchema } from '@/lib/schemas';

export interface InvoiceInsert {
  user_id: string;
  company_id: string;
  type: string;
  partner_name: string;
  invoice_number?: string | null;
  invoice_date: string;
  due_date: string;
  amount_ht: number;
  amount_ttc: number;
  vat_amount: number;
  category_id?: string | null;
  notes?: string | null;
  source?: string;
  status?: string;
}

export const invoiceApi = {
  getByCompany: async (companyId: string) => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    z.array(invoiceSchema).parse(data || []);
    return data || [];
  },

  create: async (invoice: InvoiceInsert) => {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  markAsPaid: async (id: string) => {
    const { data, error } = await supabase
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
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  updateCategory: async (id: string, categoryId: string | null) => {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        category_id: categoryId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  bulkUpdateCategoryByPartner: async (companyId: string, partnerName: string, categoryId: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({
        category_id: categoryId,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('partner_name', partnerName)
      .is('category_id', null);

    if (error) throw error;
  },

  upsertPartnerMapping: async (companyId: string, userId: string, partnerName: string, categoryId: string) => {
    const { error } = await supabase
      .from('partner_category_mappings')
      .upsert({
        company_id: companyId,
        user_id: userId,
        partner_name: partnerName,
        category_id: categoryId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,partner_name' });

    if (error) throw error;
  },

  deletePartnerMapping: async (companyId: string, partnerName: string) => {
    const { error } = await supabase
      .from('partner_category_mappings')
      .delete()
      .eq('company_id', companyId)
      .eq('partner_name', partnerName);

    if (error) throw error;
  },
};
