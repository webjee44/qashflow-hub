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

          // Update company balance
          await supabaseAdmin
            .from('companies')
            .update({ 
              bank_balance: totalBalance,
              bank_balance_updated_at: new Date().toISOString()
            })
            .eq('id', company.id);

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
    if (action === 'full-sync') {
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
      console.info('[bridge-sync] Starting full sync for user:', userId);

      // Get auth token
      await bridgeClient.getAuthToken(bridge_user_uuid);

      // Get accounts and balances
      const allAccounts = await bridgeClient.fetchAllAccounts();
      const totalBalance = bridgeClient.calculateTotalBalance(allAccounts);
      console.info(`[bridge-sync] Total balance: ${totalBalance.toLocaleString('fr-FR')}€`);

      // Update company balance
      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({ 
          bank_balance: totalBalance,
          bank_balance_updated_at: new Date().toISOString()
        })
        .eq('id', company_id);

      if (updateError) {
        console.error('[bridge-sync] Failed to update company balance:', updateError);
      } else {
        console.info('[bridge-sync] Company balance updated successfully');
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
