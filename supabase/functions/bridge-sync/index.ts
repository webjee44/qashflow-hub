// ============================================
// Bridge Sync Edge Function
// Handles: full-sync, cron-sync
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  BridgeClient, 
  BridgeAccount,
  BridgeTransaction,
  BridgeItem,
  mapBridgeStatus,
  corsHeaders, 
  errorResponse, 
  successResponse 
} from '../_shared/bridge-client.ts';
import { 
  bridgeSyncRequestSchema, 
  validateRequest, 
  validationErrorResponse 
} from '../_shared/validation.ts';

// ============================================
// Helper: Build account_id -> company_id map
// ============================================
async function getAccountToCompanyMap(
  supabaseAdmin: any,
  bridgeUserUuid: string
): Promise<Record<number, string>> {
  // Get all bridge accounts for this bridge_user_uuid
  const { data: bridgeAccounts } = await supabaseAdmin
    .from('bridge_accounts')
    .select('bridge_account_id')
    .eq('bridge_user_uuid', bridgeUserUuid);

  if (!bridgeAccounts || bridgeAccounts.length === 0) {
    return {};
  }

  const accountIds = bridgeAccounts.map((a: { bridge_account_id: number }) => a.bridge_account_id);

  // Get the company assignments for these accounts
  const { data: assignments } = await supabaseAdmin
    .from('company_bridge_accounts')
    .select('bridge_account_id, company_id')
    .in('bridge_account_id', accountIds);

  const map: Record<number, string> = {};
  for (const row of assignments || []) {
    map[row.bridge_account_id] = row.company_id;
  }

  console.info(`[bridge-sync] Account→Company map: ${Object.keys(map).length} mappings found`);
  return map;
}

// ============================================
// Helper: Calculate assigned balance and count
// ============================================
async function getAssignedAccountsStats(
  supabaseAdmin: any,
  companyId: string,
  allAccounts: BridgeAccount[]
): Promise<{ assignedCount: number; assignedBalance: number }> {
  // Fetch assigned accounts for this company
  const { data: assignedAccounts } = await supabaseAdmin
    .from('company_bridge_accounts')
    .select('bridge_account_id')
    .eq('company_id', companyId);

  // If no explicit assignments, return 0 (Option A: force user to configure)
  if (!assignedAccounts || assignedAccounts.length === 0) {
    return { assignedCount: 0, assignedBalance: 0 };
  }

  // Filter accounts to only those assigned
  const assignedAccountIds = new Set(
    assignedAccounts.map((a: { bridge_account_id: number }) => a.bridge_account_id)
  );
  const filteredAccounts = allAccounts.filter(a => assignedAccountIds.has(a.id));
  const assignedBalance = filteredAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  return { 
    assignedCount: filteredAccounts.length, 
    assignedBalance 
  };
}

// ============================================
// Helper: Sync transactions for a company
// ============================================
async function syncBridgeAccounts(
  supabaseAdmin: any,
  bridgeClient: BridgeClient,
  fallbackCompanyId: string,
  bridgeUserUuid: string,
  accounts: BridgeAccount[],
  items?: BridgeItem[]
): Promise<number> {
  let syncedCount = 0;

  // Build item status map
  const itemStatusMap = new Map<number, { status: string; message: string | null }>();
  if (items) {
    for (const item of items) {
      itemStatusMap.set(item.id, {
        status: mapBridgeStatus(item.status),
        message: item.status_code_info,
      });
    }
  }

  // CRITICAL FIX: Build account→company map from company_bridge_accounts
  // so each account gets its CORRECT company_id, not the triggering company
  const accountIds = accounts.map(a => a.id);
  const { data: assignments } = await supabaseAdmin
    .from('company_bridge_accounts')
    .select('bridge_account_id, company_id')
    .in('bridge_account_id', accountIds);

  const assignmentMap: Record<number, string> = {};
  for (const row of assignments || []) {
    assignmentMap[row.bridge_account_id] = row.company_id;
  }

  // Also get existing bridge_accounts company_id to avoid overwriting with fallback
  const { data: existingAccounts } = await supabaseAdmin
    .from('bridge_accounts')
    .select('bridge_account_id, company_id')
    .in('bridge_account_id', accountIds);

  const existingCompanyMap: Record<number, string> = {};
  for (const row of existingAccounts || []) {
    existingCompanyMap[row.bridge_account_id] = row.company_id;
  }

  const getItemId = (account: BridgeAccount): number | null => {
    const anyAccount = account as any;
    const candidate =
      anyAccount.item_id ??
      anyAccount.bridge_item_id ??
      anyAccount.bank_id ??
      anyAccount.bank?.id;

    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
  };

  for (const account of accounts) {
    const itemId = getItemId(account);
    if (!itemId) {
      console.error('[bridge-sync] Missing item id for account (cannot upsert due to NOT NULL bridge_item_id):', account);
      continue;
    }

    // Get item status for this account
    const itemStatus = itemStatusMap.get(itemId);

    // Determine correct company_id:
    // 1. Use company_bridge_accounts assignment if exists (most authoritative)
    // 2. Keep existing company_id from bridge_accounts if already set
    // 3. Fall back to the triggering company_id only for new accounts
    const correctCompanyId = assignmentMap[account.id] 
      || existingCompanyMap[account.id] 
      || fallbackCompanyId;

    const { error } = await supabaseAdmin
      .from('bridge_accounts')
      .upsert({
        bridge_account_id: account.id,
        bridge_item_id: itemId,
        bridge_user_uuid: bridgeUserUuid,
        company_id: correctCompanyId,
        name: account.name || null,
        iban: account.iban || null,
        balance: account.balance || 0,
        account_type: account.type || null,
        status: account.status || 'active',
        bank_id: account.bank_id || null,
        // Item connection status
        item_status: itemStatus?.status || 'ok',
        item_status_message: itemStatus?.message || null,
        item_status_updated_at: new Date().toISOString(),
        // IMPORTANT: bank_name is 100% manual.
        // We do NOT fetch or set it from Bridge to avoid overwriting user edits.
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'bridge_account_id',
        ignoreDuplicates: false 
      });

    if (!error) syncedCount++;
    else console.error('[bridge-sync] Failed to upsert account:', error);
  }

  console.info(`[bridge-sync] Synced ${syncedCount}/${accounts.length} bridge accounts`);
  return syncedCount;
}

async function syncCompanyTransactions(
  supabaseAdmin: any,
  bridgeClient: BridgeClient,
  companyId: string,
  userId: string,
  accounts: BridgeAccount[],
  transactions: BridgeTransaction[],
  accountToCompanyMap: Record<number, string>
): Promise<{ inserted: number; updated: number }> {
  const accountNameMap = bridgeClient.buildAccountNameMap(accounts);
  let insertedCount = 0;
  let updatedCount = 0;

  // Batch transactions by company for efficiency
  const txByCompany = new Map<string, BridgeTransaction[]>();
  for (const transaction of transactions) {
    const targetCompanyId = accountToCompanyMap[transaction.account_id];
    if (!targetCompanyId) continue; // Skip unassigned accounts
    if (!txByCompany.has(targetCompanyId)) txByCompany.set(targetCompanyId, []);
    txByCompany.get(targetCompanyId)!.push(transaction);
  }

  console.info(`[bridge-sync] Processing transactions for ${txByCompany.size} companies`);

  for (const [correctCompanyId, companyTransactions] of txByCompany) {
    // Get existing bridge_transaction_ids for this company in one query
    const bridgeIds = companyTransactions.map(t => t.id);
    const { data: existingTxs } = await supabaseAdmin
      .from('transactions')
      .select('id, bridge_transaction_id, pennylane_id')
      .eq('company_id', correctCompanyId)
      .or(
        `bridge_transaction_id.in.(${bridgeIds.join(',')}),` +
        `pennylane_id.in.(${bridgeIds.map(id => `bridge_${id}`).join(',')})`
      );

    // Build lookup maps
    const existingByBridgeId = new Map<number, string>();
    const existingByPennylaneId = new Map<string, string>();
    for (const tx of existingTxs || []) {
      if (tx.bridge_transaction_id) existingByBridgeId.set(tx.bridge_transaction_id, tx.id);
      if (tx.pennylane_id) existingByPennylaneId.set(tx.pennylane_id, tx.id);
    }

    for (const transaction of companyTransactions) {
      const transactionType = bridgeClient.getTransactionType(transaction);
      const accountName = accountNameMap[transaction.account_id] || null;
      const description = bridgeClient.getTransactionDescription(transaction);
      const absAmount = Math.abs(transaction.amount);

      // Check if already exists by bridge_transaction_id OR legacy pennylane_id
      let existingId = existingByBridgeId.get(transaction.id) 
        || existingByPennylaneId.get(`bridge_${transaction.id}`);

      // Phase 3: Fallback by signature if no ID match found
      if (!existingId) {
        const { data: signatureMatch } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('company_id', correctCompanyId)
          .eq('description', description)
          .eq('date', transaction.date)
          .eq('amount', absAmount)
          .eq('type', transactionType)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();

        if (signatureMatch) {
          existingId = signatureMatch.id;
          console.info(`[bridge-sync] Signature match found for bridge_tx ${transaction.id}`);
        }
      }

      if (existingId) {
        const { error } = await supabaseAdmin
          .from('transactions')
          .update({
            amount: absAmount,
            description: description,
            date: transaction.date,
            type: transactionType,
            bank_account_name: accountName,
            source: 'bridge',
            bridge_transaction_id: transaction.id, // Backfill for legacy rows
            company_id: correctCompanyId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId);

        if (!error) updatedCount++;
      } else {
        const { error } = await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: userId,
            company_id: correctCompanyId,
            bridge_transaction_id: transaction.id,
            pennylane_id: `bridge_${transaction.id}`,
            amount: absAmount,
            description: description,
            date: transaction.date,
            type: transactionType,
            bank_account_name: accountName,
            source: 'bridge',
            is_reconciled: false,
          });

        if (!error) insertedCount++;
        else console.warn(`[bridge-sync] Insert failed (likely duplicate trigger):`, error.message);
      }
    }
  }

  return { inserted: insertedCount, updated: updatedCount };
}

// ============================================
// Main Handler
// ============================================
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Initialize Bridge client
    const bridgeClient = new BridgeClient();
    if (!bridgeClient.isConfigured()) {
      return errorResponse('Bridge API non configurée. Ajoutez BRIDGE_CLIENT_ID et BRIDGE_CLIENT_SECRET.');
    }

    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body - will use defaults
    }

    const validation = validateRequest(bridgeSyncRequestSchema, body);
    if (!validation.success) {
      console.error('[bridge-sync] Validation error:', validation.error);
      return validationErrorResponse(validation.error, corsHeaders);
    }

    const { action, bridge_user_uuid, company_id } = validation.data;
    console.info('[bridge-sync] Action:', action);

    // ============================================
    // Action: cron-sync (No user auth required)
    // ============================================
    if (action === 'cron-sync') {
      console.info('[bridge-sync] Starting cron sync for all Bridge-connected companies...');

      // Get all companies with bridge_user_uuid
      const { data: companiesWithBridge, error: fetchError } = await supabaseAdmin
        .from('companies')
        .select('id, user_id, bridge_user_uuid')
        .not('bridge_user_uuid', 'is', null);

      if (fetchError) {
        console.error('[bridge-sync] Failed to fetch companies:', fetchError);
        return errorResponse('Failed to fetch companies', 500);
      }

      if (!companiesWithBridge || companiesWithBridge.length === 0) {
        console.info('[bridge-sync] No companies with Bridge connected');
        return successResponse({ synced: 0 });
      }

      console.info(`[bridge-sync] Found ${companiesWithBridge.length} companies to sync`);

      let syncedCount = 0;
      let totalTransactions = 0;

      for (const company of companiesWithBridge) {
        try {
          console.info(`[bridge-sync] Syncing company ${company.id}...`);

          // Get auth token
          await bridgeClient.getAuthToken(company.bridge_user_uuid!);

          // Get accounts and items (for status)
          const allAccounts = await bridgeClient.fetchAllAccounts();
          const allItems = await bridgeClient.fetchAllItems();

          // Sync bridge accounts to database (with bank names and status)
          await syncBridgeAccounts(
            supabaseAdmin,
            bridgeClient,
            company.id,
            company.bridge_user_uuid!,
            allAccounts,
            allItems
          );

          // Calculate balance and count based on assigned accounts only
          const { assignedCount, assignedBalance } = await getAssignedAccountsStats(
            supabaseAdmin,
            company.id,
            allAccounts
          );

          // Update company with assigned accounts stats
          await supabaseAdmin
            .from('companies')
            .update({ 
              bank_balance: assignedBalance,
              bank_balance_updated_at: new Date().toISOString(),
              bridge_accounts_count: assignedCount
            })
            .eq('id', company.id);

          console.info(`[bridge-sync] Company ${company.id}: ${assignedCount} assigned accounts, balance: ${assignedBalance.toLocaleString('fr-FR')}€`);

          // Get transactions
          const allTransactions = await bridgeClient.fetchAllTransactions(90);

          // Build account→company map for proper transaction assignment
          const accountToCompanyMap = await getAccountToCompanyMap(supabaseAdmin, company.bridge_user_uuid!);

          // Sync transactions with correct company assignments
          const { inserted, updated } = await syncCompanyTransactions(
            supabaseAdmin,
            bridgeClient,
            company.id,
            company.user_id,
            allAccounts,
            allTransactions,
            accountToCompanyMap
          );

          syncedCount++;
          totalTransactions += inserted + updated;
          console.info(`[bridge-sync] Company ${company.id} synced: ${allAccounts.length} accounts, ${inserted} new, ${updated} updated`);

          // Apply automation rules to newly synced uncategorized transactions
          if (inserted > 0) {
            try {
              console.info(`[bridge-sync] Applying automation rules for company ${company.id}...`);
              const applyRes = await fetch(
                `${supabaseUrl}/functions/v1/apply-all-automation-rules`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({ company_id: company.id }),
                }
              );
              const applyData = await applyRes.json();
              console.info(`[bridge-sync] Auto-categorized ${applyData.updated || 0} transactions for company ${company.id}`);
            } catch (autoErr) {
              console.error(`[bridge-sync] Failed to apply automation rules for company ${company.id}:`, autoErr);
            }
          }
        } catch (err) {
          console.error(`[bridge-sync] Error syncing company ${company.id}:`, err);
        }
      }

      console.info(`[bridge-sync] Cron sync complete: ${syncedCount} companies, ${totalTransactions} transactions`);

      return successResponse({ 
        synced: syncedCount,
        totalTransactions 
      });
    }

    // ============================================
    // Action: full-sync (User auth required)
    // ============================================
    if (action === 'sync-accounts' || action === 'full-sync') {
      if (!bridge_user_uuid || !company_id) {
        return errorResponse('bridge_user_uuid et company_id requis');
      }

      // Authenticate user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return errorResponse('Unauthorized', 401);
      }

      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);

      if (claimsError || !claimsData?.claims) {
        console.error('[bridge-sync] Auth error:', claimsError);
        return errorResponse('Unauthorized', 401);
      }

      const userId = claimsData.claims.sub as string;
      console.info(`[bridge-sync] Starting ${action} for user:`, userId);

      // Get auth token
      await bridgeClient.getAuthToken(bridge_user_uuid);

      // Get accounts, balances and items (for status)
      const allAccounts = await bridgeClient.fetchAllAccounts();
      const allItems = await bridgeClient.fetchAllItems();
      console.info(`[bridge-sync] Fetched ${allAccounts.length} accounts and ${allItems.length} items from Bridge`);

      // Sync bridge accounts to database (with bank names and status)
      const syncedAccounts = await syncBridgeAccounts(
        supabaseAdmin,
        bridgeClient,
        company_id,
        bridge_user_uuid,
        allAccounts,
        allItems
      );

      // Calculate balance and count based on assigned accounts only
      const { assignedCount, assignedBalance } = await getAssignedAccountsStats(
        supabaseAdmin,
        company_id,
        allAccounts
      );

      console.info(`[bridge-sync] Assigned accounts: ${assignedCount}, balance: ${assignedBalance.toLocaleString('fr-FR')}€`);

      // Update company with assigned accounts stats
      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({ 
          bank_balance: assignedBalance,
          bank_balance_updated_at: new Date().toISOString(),
          bridge_accounts_count: assignedCount
        })
        .eq('id', company_id);

      if (updateError) {
        console.error('[bridge-sync] Failed to update company balance:', updateError);
      } else {
        console.info('[bridge-sync] Company balance updated successfully');
      }

      if (action === 'sync-accounts') {
        return successResponse({
          accounts: allAccounts.length,
          syncedAccounts,
          assignedCount,
          totalBalance: assignedBalance,
        });
      }

      // Get transactions
      const allTransactions = await bridgeClient.fetchAllTransactions(90);

      // Build account→company map for proper transaction assignment
      const accountToCompanyMap = await getAccountToCompanyMap(supabaseAdmin, bridge_user_uuid);

      // Sync transactions with correct company assignments
      const { inserted, updated } = await syncCompanyTransactions(
        supabaseAdmin,
        bridgeClient,
        company_id,
        userId,
        allAccounts,
        allTransactions,
        accountToCompanyMap
      );

      console.info(`[bridge-sync] Full sync complete: ${allAccounts.length} accounts, ${inserted} new, ${updated} updated transactions`);

      // Apply automation rules after full-sync if new transactions were inserted
      if (inserted > 0) {
        try {
          console.info(`[bridge-sync] Applying automation rules after full-sync for company ${company_id}...`);
          const applyRes = await fetch(
            `${supabaseUrl}/functions/v1/apply-all-automation-rules`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ company_id }),
            }
          );
          const applyData = await applyRes.json();
          console.info(`[bridge-sync] Auto-categorized ${applyData.updated || 0} transactions`);
        } catch (autoErr) {
          console.error(`[bridge-sync] Failed to apply automation rules:`, autoErr);
        }
      }

      return successResponse({ 
        accounts: allAccounts.length,
        syncedAccounts,
        assignedCount,
        totalBalance: assignedBalance,
        inserted, 
        updated 
      });
    }

    return errorResponse(`Action non reconnue: ${action}`);

  } catch (error) {
    console.error('[bridge-sync] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur Bridge: ${errorMessage}`, 500);
  }
});
