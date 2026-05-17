import { supabase } from '@/integrations/supabase/client';
import { normalizeAmount, INTERNAL_TRANSFER_CATEGORY_NAME } from '@/lib/finance';
import type {
  TreasuryActualTransaction,
  StoredCashFlowBucket,
} from '../types/treasuryActuals';

export interface GetTreasuryActualsParams {
  companyId: string;
  fromDate: string;   // ISO YYYY-MM-DD inclusive
  toDate: string;     // ISO YYYY-MM-DD inclusive
}

const PAGE_SIZE = 1000;

/**
 * Returns the actual treasury-relevant transactions for the period, with the
 * filters mandated by the treasury engine:
 *   - company_id, deleted_at IS NULL, is_ignored = false
 *   - date in [fromDate, toDate]
 *   - bridge transactions: only on accounts present in company_active_bridge_accounts
 *   - manual transactions (bridge_account_id IS NULL) are kept
 *   - category joined for cash_flow_bucket (nullable) and name (internal transfer flag)
 *
 * Pagination > 1000 rows via range loop.
 *
 * The category's `cash_flow_bucket` is included (nullable). Transactions
 * without a bucket are routed to `uncategorized_*` by `buildTreasuryActuals`.
 */
export async function getTreasuryActuals(
  params: GetTreasuryActualsParams,
): Promise<TreasuryActualTransaction[]> {
  const { companyId, fromDate, toDate } = params;

  // 1. Active bridge_account_ids for this company (single round-trip).
  const { data: activeAccounts, error: accErr } = await supabase
    .from('company_active_bridge_accounts')
    .select('bridge_account_id')
    .eq('company_id', companyId);
  if (accErr) throw accErr;
  const activeBridgeIds = new Set<number>(
    (activeAccounts ?? [])
      .map((r: { bridge_account_id: number | null }) => r.bridge_account_id)
      .filter((id): id is number => typeof id === 'number'),
  );

  // 2. Paginated fetch of transactions with category joined.
  const rows: Array<{
    id: string;
    company_id: string;
    date: string;
    type: 'income' | 'expense';
    amount: number | string;
    description: string | null;
    category_id: string | null;
    bridge_account_id: number | null;
    categories: { id: string; name: string; cash_flow_bucket: StoredCashFlowBucket | null } | null;
  }> = [];

  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id, company_id, date, type, amount, description, category_id, bridge_account_id,
        categories ( id, name, cash_flow_bucket )
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .eq('is_ignored', false)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // 3. Map → TreasuryActualTransaction with filters.
  const result: TreasuryActualTransaction[] = [];
  for (const r of rows) {
    // Active bridge scope: drop bridge transactions whose account is not active.
    if (r.bridge_account_id !== null && r.bridge_account_id !== undefined) {
      if (!activeBridgeIds.has(r.bridge_account_id)) continue;
    }

    const categoryName = r.categories?.name ?? null;
    result.push({
      id: r.id,
      companyId: r.company_id,
      date: r.date,
      type: r.type,
      amount: normalizeAmount(r.amount),
      description: r.description ?? '',
      categoryId: r.category_id,
      categoryName,
      cashFlowBucket: r.categories?.cash_flow_bucket ?? null,
      bridgeAccountId: r.bridge_account_id,
      isInternalTransfer: categoryName === INTERNAL_TRANSFER_CATEGORY_NAME,
    });
  }
  return result;
}

export const treasuryActualsApi = { getTreasuryActuals };
