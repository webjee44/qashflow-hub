import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export class TransactionRepository {
  constructor(private client: SupabaseClient) {}

  async findById(id: string) {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findByCompany(companyId: string, options?: { limit?: number; uncategorizedOnly?: boolean }) {
    let q = this.client
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (options?.uncategorizedOnly) {
      q = q.is('category_id', null);
    }

    if (options?.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async upsertMany(transactions: Record<string, unknown>[], onConflict?: string) {
    const opts = onConflict ? { onConflict } : undefined;
    const { error } = await this.client
      .from('transactions')
      .upsert(transactions as any, opts);

    if (error) throw error;
  }

  async insertMany(transactions: Record<string, unknown>[]) {
    const { error } = await this.client
      .from('transactions')
      .insert(transactions as any);

    if (error) throw error;
  }

  async updateCategory(id: string, categoryId: string) {
    const { error } = await this.client
      .from('transactions')
      .update({ category_id: categoryId })
      .eq('id', id);

    if (error) throw error;
  }

  async bulkUpdateCategory(ids: string[], categoryId: string) {
    const { error } = await this.client
      .from('transactions')
      .update({ category_id: categoryId })
      .in('id', ids);

    if (error) throw error;
  }

  async softDelete(id: string) {
    const { error } = await this.client
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async findByBridgeIds(companyId: string, bridgeIds: number[]) {
    const { data, error } = await this.client
      .from('transactions')
      .select('id, bridge_transaction_id, pennylane_id')
      .eq('company_id', companyId)
      .in('bridge_transaction_id', bridgeIds);

    if (error) throw error;
    return data || [];
  }

  async findBySignature(companyId: string, date: string, amount: number, description: string) {
    const { data, error } = await this.client
      .from('transactions')
      .select('id')
      .eq('company_id', companyId)
      .eq('date', date)
      .eq('amount', amount)
      .eq('description', description)
      .is('bridge_transaction_id', null)
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  }

  async update(id: string, fields: Record<string, unknown>) {
    const { error } = await this.client
      .from('transactions')
      .update(fields)
      .eq('id', id);

    if (error) throw error;
  }

  async findUncategorized(
    filter: { userId?: string; companyId?: string },
    options?: { pageSize?: number }
  ) {
    const pageSize = options?.pageSize || 1000;
    let allTransactions: Record<string, unknown>[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = this.client
        .from('transactions')
        .select('id, description, amount, type, category_id, user_id, company_id, bank_account_name, merchant_key, normalized_description')
        .is('category_id', null)
        .is('deleted_at', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filter.companyId) {
        query = query.eq('company_id', filter.companyId);
      } else if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }

      const { data: batch, error } = await query;
      if (error) throw error;

      if (batch && batch.length > 0) {
        allTransactions = allTransactions.concat(batch);
        hasMore = batch.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    return allTransactions;
  }

  async updateWithOwnerCheck(id: string, userId: string, fields: Record<string, unknown>) {
    const { error } = await this.client
      .from('transactions')
      .update(fields)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }
}
