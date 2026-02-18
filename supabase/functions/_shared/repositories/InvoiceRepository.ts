import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export class InvoiceRepository {
  constructor(private client: SupabaseClient) {}

  async findByExternalId(companyId: string, externalId: string) {
    const { data, error } = await this.client
      .from('invoices')
      .select('id')
      .eq('external_id', externalId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async insert(invoice: Record<string, unknown>) {
    const { error } = await this.client
      .from('invoices')
      .insert(invoice as any);

    if (error) throw error;
  }

  async update(id: string, fields: Record<string, unknown>) {
    const { error } = await this.client
      .from('invoices')
      .update(fields)
      .eq('id', id);

    if (error) throw error;
  }

  async deleteBySourceAndExternalIds(companyId: string, source: string, externalIds: string[]) {
    const { error } = await this.client
      .from('invoices')
      .delete()
      .eq('company_id', companyId)
      .eq('source', source)
      .in('external_id', externalIds);

    if (error) throw error;
  }

  async findPartnerMapping(companyId: string, partnerName: string) {
    const { data, error } = await this.client
      .from('partner_category_mappings')
      .select('category_id')
      .eq('company_id', companyId)
      .eq('partner_name', partnerName)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
