// ============================================
// Bridge Accounts Edge Function
// ============================================
// Source de vérité Qashflow:
//   - action `get-accounts` (avec company_id requis): lit la vue
//     `company_active_bridge_accounts` — ne contacte JAMAIS Bridge.
//     Les comptes exclus côté Qashflow ne sont donc jamais retournés.
//   - action `get-bridge-raw-accounts`: réservée debug/admin (superadmin),
//     contacte Bridge pour montrer ce que la banque expose. Ne doit pas
//     être consommée par le dashboard ni par les paramètres.
//   - action `get-transaction-categories`: utilitaire d'analyse Bridge.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BridgeClient,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/bridge-client.ts';
import {
  bridgeAccountsRequestSchema,
  validateRequest,
  validationErrorResponse,
} from '../_shared/validation.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty body — caught by validation
    }

    const validation = validateRequest(bridgeAccountsRequestSchema, body);
    if (!validation.success) {
      console.error('[bridge-accounts] Validation error:', validation.error);
      return validationErrorResponse(validation.error, corsHeaders);
    }

    const { action, bridge_user_uuid, company_id } = validation.data;
    console.info('[bridge-accounts] Action:', action);

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('[bridge-accounts] Auth error:', claimsError);
      return errorResponse('Unauthorized', 401);
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================
    // Action: get-accounts — SOURCE QASHFLOW UNIQUEMENT
    // ============================================
    if (action === 'get-accounts') {
      if (!company_id) {
        return errorResponse(
          'company_id requis. La liste brute Bridge n\'est plus exposée par cette action — utiliser get-bridge-raw-accounts (admin).',
          400,
        );
      }

      // Vérifie que l'utilisateur a bien accès à la société
      const { data: hasAccess, error: accessErr } = await supabaseAdmin.rpc(
        'has_company_access',
        { _user_id: userId, _company_id: company_id },
      );
      if (accessErr || !hasAccess) {
        return errorResponse('Forbidden', 403);
      }

      const { data, error } = await supabaseAdmin
        .from('company_active_bridge_accounts')
        .select(
          'bridge_account_id, name, balance, iban, account_type, item_status, updated_at, bank_name, bridge_item_id',
        )
        .eq('company_id', company_id);

      if (error) {
        console.error('[bridge-accounts] Read view error:', error);
        return errorResponse('Erreur lecture comptes', 500);
      }

      const accounts = (data || []).map((row: any) => ({
        id: String(row.bridge_account_id),
        bridge_account_id: row.bridge_account_id,
        bridge_item_id: row.bridge_item_id,
        name: row.name,
        balance: Number(row.balance ?? 0),
        iban: row.iban,
        type: row.account_type,
        bank_name: row.bank_name,
        item_status: row.item_status,
        updated_at: row.updated_at,
      }));

      const totalBalance = accounts.reduce(
        (sum: number, a: any) => sum + (Number(a.balance) || 0),
        0,
      );

      return successResponse({
        accounts,
        totalBalance,
        total_balance: totalBalance, // alias historique pour compat front
        source: 'qashflow_company_active_bridge_accounts',
      });
    }

    // ============================================
    // Action: get-bridge-raw-accounts — DEBUG ADMIN
    // Retourne ce que Bridge expose réellement.
    // Ne doit jamais alimenter dashboard / paramètres.
    // ============================================
    if (action === 'get-bridge-raw-accounts') {
      const { data: isSuperadmin } = await supabaseAdmin.rpc('is_superadmin', {
        _user_id: userId,
      });
      if (!isSuperadmin) {
        return errorResponse('Forbidden — superadmin requis', 403);
      }

      const bridgeClient = new BridgeClient();
      if (!bridgeClient.isConfigured()) {
        return errorResponse('Bridge API non configurée');
      }
      const authData = await bridgeClient.getAuthToken(bridge_user_uuid);
      bridgeClient.setAccessToken(authData.access_token);

      const allAccounts = await bridgeClient.fetchAllAccounts();
      const totalBalance = bridgeClient.calculateTotalBalance(allAccounts);

      return successResponse({
        accounts: allAccounts,
        totalBalance,
        source: 'bridge_raw',
      });
    }

    // ============================================
    // Action: get-transaction-categories
    // ============================================
    if (action === 'get-transaction-categories') {
      const bridgeClient = new BridgeClient();
      if (!bridgeClient.isConfigured()) {
        return errorResponse('Bridge API non configurée');
      }
      const authData = await bridgeClient.getAuthToken(bridge_user_uuid);
      bridgeClient.setAccessToken(authData.access_token);

      const allTransactions = await bridgeClient.fetchAllTransactions(90);
      const categoryStats: Record<number, { count: number; examples: string[] }> = {};

      for (const tx of allTransactions) {
        if (tx.category_id !== null) {
          if (!categoryStats[tx.category_id]) {
            categoryStats[tx.category_id] = { count: 0, examples: [] };
          }
          categoryStats[tx.category_id].count++;
          if (categoryStats[tx.category_id].examples.length < 3) {
            categoryStats[tx.category_id].examples.push(
              bridgeClient.getTransactionDescription(tx),
            );
          }
        }
      }

      const sortedCategories = Object.entries(categoryStats)
        .map(([id, data]) => ({
          bridge_category_id: parseInt(id),
          count: data.count,
          examples: data.examples,
        }))
        .sort((a, b) => b.count - a.count);

      return successResponse({
        total_transactions: allTransactions.length,
        categories: sortedCategories,
      });
    }

    return errorResponse(`Action non reconnue: ${action}`);
  } catch (error) {
    console.error('[bridge-accounts] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur Bridge: ${errorMessage}`, 500);
  }
});
