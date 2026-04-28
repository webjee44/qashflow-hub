// ============================================
// Bridge Refresh Balances Edge Function
// ----
// Forces Bridge to re-contact the connected banks for all companies in the
// caller's group, then re-reads the balances. Scope is BALANCES ONLY:
// no transaction sync, no heavy DB write, no recompute except via the
// existing `recompute_company_bank_stats` triggers fired by upserting
// bridge_accounts.balance.
//
// Why a dedicated endpoint?
// - Multi-company / multi-bridge_user_uuid orchestration
// - Deduplicates work per Bridge user (one user can power multiple companies)
// - Honest separation from `bridge-sync` (transactions) and `bridge-accounts`
//   (passive read of Bridge cache)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BridgeClient,
  BridgeAccount,
  BridgeItem,
  mapBridgeStatus,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/bridge-client.ts';
import {
  bridgeRefreshBalancesRequestSchema,
  validateRequest,
  validationErrorResponse,
} from '../_shared/validation.ts';

// How long to wait between asking Bridge to refresh and re-reading
// the resulting accounts. Bridge processes refresh asynchronously;
// 4s is a pragmatic compromise between freshness and edge-function timeout.
const REFRESH_PROPAGATION_DELAY_MS = 4000;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Re-read Bridge accounts and upsert balances into our `bridge_accounts` table.
 * The DB trigger `trg_recompute_on_cba_change` does NOT fire here (it's on
 * company_bridge_accounts), so we explicitly recompute company stats after.
 */
async function refreshBridgeUser(
  supabaseAdmin: any,
  bridgeUserUuid: string,
  bridgeClient: BridgeClient,
): Promise<{
  bridge_user_uuid: string;
  refreshed_items: number;
  skipped_items: number;
  refresh_errors: number;
  updated_accounts: number;
}> {
  // Authenticate against Bridge for this specific user
  const auth = await bridgeClient.getAuthToken(bridgeUserUuid);
  bridgeClient.setAccessToken(auth.access_token);

  // 1. Force banks to re-sync via Bridge
  const refreshResult = await bridgeClient.refreshAllItems();

  // 2. Wait for Bridge to propagate (best effort — the webhook will catch up
  //    later anyway, this just maximizes the chance of fresh values right now)
  await sleep(REFRESH_PROPAGATION_DELAY_MS);

  // 3. Re-read latest accounts + items (for status mapping)
  const [accounts, items] = await Promise.all([
    bridgeClient.fetchAllAccounts(),
    bridgeClient.fetchAllItems(),
  ]);

  // 4. Upsert balances into bridge_accounts (preserving company_id assignment)
  const updatedAccounts = await upsertBridgeAccountBalances(
    supabaseAdmin,
    bridgeUserUuid,
    accounts,
    items,
  );

  return {
    bridge_user_uuid: bridgeUserUuid,
    refreshed_items: refreshResult.refreshed,
    skipped_items: refreshResult.skipped,
    refresh_errors: refreshResult.errors,
    updated_accounts: updatedAccounts,
  };
}

/**
 * Upsert account balances ONLY (no transactions). Preserves the existing
 * `company_id` assignment (we never reassign during a balance refresh).
 */
async function upsertBridgeAccountBalances(
  supabaseAdmin: any,
  bridgeUserUuid: string,
  accounts: BridgeAccount[],
  items: BridgeItem[],
): Promise<number> {
  if (accounts.length === 0) return 0;

  // Build item status map
  const itemStatusMap = new Map<number, { status: string; message: string | null }>();
  for (const item of items) {
    itemStatusMap.set(item.id, {
      status: mapBridgeStatus(item.status),
      message: item.status_code_info,
    });
  }

  // Preserve existing company_id assignments — a balance refresh must NEVER
  // reassign accounts. If an account is unknown locally we skip it (it will
  // be picked up by the next full bridge-sync).
  const accountIds = accounts.map(a => a.id);
  const { data: existing } = await supabaseAdmin
    .from('bridge_accounts')
    .select('bridge_account_id, company_id')
    .in('bridge_account_id', accountIds);

  const knownCompanyByAccount = new Map<number, string>();
  for (const row of existing || []) {
    knownCompanyByAccount.set(row.bridge_account_id, row.company_id);
  }

  const getItemId = (account: BridgeAccount): number | null => {
    const a = account as any;
    const candidate = a.item_id ?? a.bridge_item_id ?? a.bank_id ?? a.bank?.id;
    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
  };

  let updated = 0;
  const affectedCompanyIds = new Set<string>();

  for (const account of accounts) {
    const companyId = knownCompanyByAccount.get(account.id);
    if (!companyId) {
      // Unknown account locally — skip (do not invent a company assignment).
      continue;
    }

    const itemId = getItemId(account);
    if (!itemId) continue;

    const itemStatus = itemStatusMap.get(itemId);

    const { error } = await supabaseAdmin
      .from('bridge_accounts')
      .update({
        balance: account.balance ?? 0,
        item_status: itemStatus?.status || 'ok',
        item_status_message: itemStatus?.message || null,
        item_status_updated_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('bridge_account_id', account.id)
      .eq('bridge_user_uuid', bridgeUserUuid);

    if (!error) {
      updated++;
      affectedCompanyIds.add(companyId);
    } else {
      console.error('[bridge-refresh-balances] Update failed for account', account.id, error);
    }
  }

  // Recompute denormalized bank_balance / bridge_accounts_count on companies
  // (single source of truth: company_bridge_accounts JOIN bridge_accounts)
  for (const companyId of affectedCompanyIds) {
    const { error } = await supabaseAdmin.rpc('recompute_company_bank_stats', {
      p_company_id: companyId,
    });
    if (error) {
      console.error('[bridge-refresh-balances] recompute failed for', companyId, error);
    }
  }

  console.info(`[bridge-refresh-balances] Updated ${updated} accounts across ${affectedCompanyIds.size} companies`);
  return updated;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const bridgeClient = new BridgeClient();
    if (!bridgeClient.isConfigured()) {
      return errorResponse('Bridge API non configurée');
    }

    // Validate body
    let body: unknown = {};
    try { body = await req.json(); } catch { /* fallthrough to validation */ }
    const validation = validateRequest(bridgeRefreshBalancesRequestSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, corsHeaders);
    }
    const { company_ids } = validation.data;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401);
    }
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return errorResponse('Unauthorized', 401);
    }
    const userId = claims.claims.sub as string;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify access to every company_id (defense in depth — DB RLS already
    // protects bridge_accounts, but this lets us fail fast and clearly).
    const accessChecks = await Promise.all(
      company_ids.map(async (cid) => {
        const { data, error } = await supabaseAdmin.rpc('has_company_access', {
          _user_id: userId,
          _company_id: cid,
        });
        return { cid, allowed: !error && data === true };
      })
    );
    const denied = accessChecks.filter(c => !c.allowed).map(c => c.cid);
    if (denied.length > 0) {
      console.warn('[bridge-refresh-balances] Access denied for companies:', denied);
      return errorResponse(`Access denied for ${denied.length} company(ies)`, 403);
    }

    // Resolve bridge_user_uuid per company, dedupe (one Bridge user can serve
    // multiple companies — we must refresh each Bridge user only once).
    const { data: companies, error: compError } = await supabaseAdmin
      .from('companies')
      .select('id, bridge_user_uuid')
      .in('id', company_ids);

    if (compError) {
      console.error('[bridge-refresh-balances] Companies query failed:', compError);
      return errorResponse('Erreur lors de la récupération des sociétés', 500);
    }

    const bridgeUserUuids = Array.from(
      new Set(
        (companies || [])
          .map((c: any) => c.bridge_user_uuid)
          .filter((u: string | null): u is string => typeof u === 'string' && u.length > 0)
      )
    );

    if (bridgeUserUuids.length === 0) {
      return successResponse({
        refreshed_users: 0,
        refreshed_items: 0,
        updated_accounts: 0,
        message: 'Aucune banque connectée à actualiser',
      });
    }

    console.info(`[bridge-refresh-balances] Refreshing ${bridgeUserUuids.length} Bridge user(s) for ${company_ids.length} company(ies)`);

    // Refresh each Bridge user sequentially (each call already parallelizes
    // its own item refreshes). Sequential here keeps the auth token state
    // sane on BridgeClient and avoids hammering Bridge.
    const perUserResults: Awaited<ReturnType<typeof refreshBridgeUser>>[] = [];
    for (const uuid of bridgeUserUuids) {
      try {
        const result = await refreshBridgeUser(supabaseAdmin, uuid, bridgeClient);
        perUserResults.push(result);
      } catch (err) {
        console.error('[bridge-refresh-balances] Failed for', uuid, err);
        perUserResults.push({
          bridge_user_uuid: uuid,
          refreshed_items: 0,
          skipped_items: 0,
          refresh_errors: 1,
          updated_accounts: 0,
        });
      }
    }

    const totals = perUserResults.reduce(
      (acc, r) => ({
        refreshed_items: acc.refreshed_items + r.refreshed_items,
        skipped_items: acc.skipped_items + r.skipped_items,
        refresh_errors: acc.refresh_errors + r.refresh_errors,
        updated_accounts: acc.updated_accounts + r.updated_accounts,
      }),
      { refreshed_items: 0, skipped_items: 0, refresh_errors: 0, updated_accounts: 0 }
    );

    return successResponse({
      refreshed_users: bridgeUserUuids.length,
      ...totals,
      details: perUserResults,
    });
  } catch (error) {
    console.error('[bridge-refresh-balances] Error:', error);
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur: ${msg}`, 500);
  }
});
