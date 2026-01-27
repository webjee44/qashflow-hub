// ============================================
// Bridge Sync Edge Function
// Handles: full-sync, cron-sync
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  BridgeClient, 
  BridgeAccount,
  BridgeTransaction,
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
// Helper: Sync transactions for a company
// ============================================
async function syncBridgeAccounts(
  supabaseAdmin: any,
  bridgeClient: BridgeClient,
  companyId: string,
  bridgeUserUuid: string,
  accounts: BridgeAccount[]
): Promise<number> {
  let syncedCount = 0;

  // Collect all bank_ids and fetch bank names
  const bankIds = accounts.map(a => a.bank_id).filter(id => id != null);
  const bankMap = await bridgeClient.fetchBanks(bankIds);

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

    // Get bank name from the fetched bank data
    const bank = bankMap.get(account.bank_id);
    const bankName = bank?.name || null;

    const { error } = await supabaseAdmin
      .from('bridge_accounts')
      .upsert({
        bridge_account_id: account.id,
        bridge_item_id: itemId,
        bridge_user_uuid: bridgeUserUuid,
        company_id: companyId,
        name: account.name || null,
        iban: account.iban || null,
        balance: account.balance || 0,
        account_type: account.type || null,
        status: account.status || 'active',
        bank_id: account.bank_id || null,
        bank_name: bankName,
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
  transactions: BridgeTransaction[]
): Promise<{ inserted: number; updated: number }> {
  const accountNameMap = bridgeClient.buildAccountNameMap(accounts);
  let insertedCount = 0;
  let updatedCount = 0;

  for (const transaction of transactions) {
    const transactionType = bridgeClient.getTransactionType(transaction);
    const accountName = accountNameMap[transaction.account_id] || null;
    const description = bridgeClient.getTransactionDescription(transaction);

    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('pennylane_id', `bridge_${transaction.id}`)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('transactions')
        .update({
          amount: Math.abs(transaction.amount),
          description: description,
          date: transaction.date,
          type: transactionType,
          bank_account_name: accountName,
          source: 'bridge',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (!error) updatedCount++;
    } else {
      const { error } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          company_id: companyId,
          pennylane_id: `bridge_${transaction.id}`,
          amount: Math.abs(transaction.amount),
          description: description,
          date: transaction.date,
          type: transactionType,
          bank_account_name: accountName,
          source: 'bridge',
          is_reconciled: false,
        });

      if (!error) insertedCount++;
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

          // Get accounts
          const allAccounts = await bridgeClient.fetchAllAccounts();
          const totalBalance = bridgeClient.calculateTotalBalance(allAccounts);

          // Update company balance and accounts count
          await supabaseAdmin
            .from('companies')
            .update({ 
              bank_balance: totalBalance,
              bank_balance_updated_at: new Date().toISOString(),
              bridge_accounts_count: allAccounts.length
            })
            .eq('id', company.id);

          // Sync bridge accounts to database (with bank names)
          await syncBridgeAccounts(
            supabaseAdmin,
            bridgeClient,
            company.id,
            company.bridge_user_uuid!,
            allAccounts
          );

          // Get transactions
          const allTransactions = await bridgeClient.fetchAllTransactions(90);

          // Sync transactions
          const { inserted, updated } = await syncCompanyTransactions(
            supabaseAdmin,
            bridgeClient,
            company.id,
            company.user_id,
            allAccounts,
            allTransactions
          );

          syncedCount++;
          totalTransactions += inserted + updated;
          console.info(`[bridge-sync] Company ${company.id} synced: ${allAccounts.length} accounts, ${inserted} new, ${updated} updated`);
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

      // Get accounts and balances
      const allAccounts = await bridgeClient.fetchAllAccounts();
      const totalBalance = bridgeClient.calculateTotalBalance(allAccounts);
      console.info(`[bridge-sync] Total balance: ${totalBalance.toLocaleString('fr-FR')}€`);

      // Update company balance and accounts count
      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({ 
          bank_balance: totalBalance,
          bank_balance_updated_at: new Date().toISOString(),
          bridge_accounts_count: allAccounts.length
        })
        .eq('id', company_id);

      if (updateError) {
        console.error('[bridge-sync] Failed to update company balance:', updateError);
      } else {
        console.info('[bridge-sync] Company balance updated successfully');
      }

      // Sync bridge accounts to database (with bank names)
      const syncedAccounts = await syncBridgeAccounts(
        supabaseAdmin,
        bridgeClient,
        company_id,
        bridge_user_uuid,
        allAccounts
      );

      if (action === 'sync-accounts') {
        return successResponse({
          accounts: allAccounts.length,
          syncedAccounts,
          totalBalance,
        });
      }

      // Get transactions
      const allTransactions = await bridgeClient.fetchAllTransactions(90);

      // Sync transactions
      const { inserted, updated } = await syncCompanyTransactions(
        supabaseAdmin,
        bridgeClient,
        company_id,
        userId,
        allAccounts,
        allTransactions
      );

      console.info(`[bridge-sync] Full sync complete: ${allAccounts.length} accounts, ${inserted} new, ${updated} updated transactions`);

      return successResponse({ 
        accounts: allAccounts.length,
        syncedAccounts,
        totalBalance,
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
