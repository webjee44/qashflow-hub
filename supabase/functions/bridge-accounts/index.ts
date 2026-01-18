// ============================================
// Bridge Accounts Edge Function
// Handles: get-accounts, get-transaction-categories
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  BridgeClient, 
  corsHeaders, 
  errorResponse, 
  successResponse 
} from '../_shared/bridge-client.ts';
import { 
  bridgeAccountsRequestSchema, 
  validateRequest, 
  validationErrorResponse 
} from '../_shared/validation.ts';

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

    // Parse and validate request body
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body - will fail validation
    }

    const validation = validateRequest(bridgeAccountsRequestSchema, body);
    if (!validation.success) {
      console.error('[bridge-accounts] Validation error:', validation.error);
      return validationErrorResponse(validation.error, corsHeaders);
    }

    const { action, bridge_user_uuid, company_id } = validation.data;
    console.info('[bridge-accounts] Action:', action);

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
      console.error('[bridge-accounts] Auth error:', claimsError);
      return errorResponse('Unauthorized', 401);
    }

    console.info('[bridge-accounts] User authenticated');

    // Get auth token
    const authData = await bridgeClient.getAuthToken(bridge_user_uuid);
    bridgeClient.setAccessToken(authData.access_token);

    // ============================================
    // Action: get-accounts
    // ============================================
    if (action === 'get-accounts') {
      const allAccounts = await bridgeClient.fetchAllAccounts();
      const totalBalance = bridgeClient.calculateTotalBalance(allAccounts);

      // Update company balance if company_id provided
      if (company_id) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        await supabaseAdmin
          .from('companies')
          .update({ 
            bank_balance: totalBalance,
            bank_balance_updated_at: new Date().toISOString()
          })
          .eq('id', company_id);
      }

      return successResponse({ 
        accounts: allAccounts,
        totalBalance
      });
    }

    // ============================================
    // Action: get-transaction-categories
    // ============================================
    if (action === 'get-transaction-categories') {
      console.info('[bridge-accounts] Fetching transaction categories...');

      const allTransactions = await bridgeClient.fetchAllTransactions(90);

      // Analyze category_ids
      const categoryStats: Record<number, { count: number; examples: string[] }> = {};

      for (const tx of allTransactions) {
        if (tx.category_id !== null) {
          if (!categoryStats[tx.category_id]) {
            categoryStats[tx.category_id] = { count: 0, examples: [] };
          }
          categoryStats[tx.category_id].count++;
          if (categoryStats[tx.category_id].examples.length < 3) {
            categoryStats[tx.category_id].examples.push(
              bridgeClient.getTransactionDescription(tx)
            );
          }
        }
      }

      // Sort by count
      const sortedCategories = Object.entries(categoryStats)
        .map(([id, data]) => ({ 
          bridge_category_id: parseInt(id), 
          count: data.count, 
          examples: data.examples 
        }))
        .sort((a, b) => b.count - a.count);

      console.info(`[bridge-accounts] Found ${sortedCategories.length} unique categories`);

      return successResponse({ 
        total_transactions: allTransactions.length,
        categories: sortedCategories
      });
    }

    return errorResponse(`Action non reconnue: ${action}`);

  } catch (error) {
    console.error('[bridge-accounts] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur Bridge: ${errorMessage}`, 500);
  }
});
