// ============================================
// Admin Bridge Delete - Service Role Only
// Deletes a Bridge user and cleans up local data
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  BridgeClient, 
  corsHeaders, 
  errorResponse, 
  successResponse 
} from '../_shared/bridge-client.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse request body
    let body: { bridge_user_uuid?: string } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse('Corps JSON invalide');
    }

    const { bridge_user_uuid } = body;
    
    if (!bridge_user_uuid) {
      return errorResponse('bridge_user_uuid requis');
    }

    console.info('[admin-bridge-delete] Deleting Bridge user:', bridge_user_uuid);

    // Initialize Bridge client
    const bridgeClient = new BridgeClient();
    if (!bridgeClient.isConfigured()) {
      return errorResponse('Bridge API non configurée');
    }

    // Delete user from Bridge API
    try {
      await bridgeClient.deleteUser(bridge_user_uuid);
      console.info('[admin-bridge-delete] Bridge user deleted from API');
    } catch (bridgeError) {
      console.error('[admin-bridge-delete] Bridge API error:', bridgeError);
      // Continue with local cleanup even if Bridge API fails
    }

    // Clean up local database
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get bridge account IDs first
    const { data: bridgeAccountsData } = await supabaseAdmin
      .from('bridge_accounts')
      .select('bridge_account_id')
      .eq('bridge_user_uuid', bridge_user_uuid);

    const bridgeAccountIds = bridgeAccountsData?.map(a => a.bridge_account_id) || [];

    // Delete company_bridge_accounts mappings
    if (bridgeAccountIds.length > 0) {
      const { error: deleteMappingsError } = await supabaseAdmin
        .from('company_bridge_accounts')
        .delete()
        .in('bridge_account_id', bridgeAccountIds);

      if (deleteMappingsError) {
        console.error('[admin-bridge-delete] Error deleting mappings:', deleteMappingsError);
      }
    }

    // Delete bridge_accounts
    const { error: deleteAccountsError } = await supabaseAdmin
      .from('bridge_accounts')
      .delete()
      .eq('bridge_user_uuid', bridge_user_uuid);

    if (deleteAccountsError) {
      console.error('[admin-bridge-delete] Error deleting bridge_accounts:', deleteAccountsError);
    }

    // Clear bridge_user_uuid from companies
    const { data: updatedCompanies, error: updateCompaniesError } = await supabaseAdmin
      .from('companies')
      .update({ bridge_user_uuid: null, bridge_accounts_count: 0 })
      .eq('bridge_user_uuid', bridge_user_uuid)
      .select('id, name');

    if (updateCompaniesError) {
      console.error('[admin-bridge-delete] Error updating companies:', updateCompaniesError);
    }

    console.info('[admin-bridge-delete] Cleanup complete. Companies updated:', updatedCompanies?.length || 0);

    return successResponse({ 
      deleted: true, 
      bridge_user_uuid,
      companies_updated: updatedCompanies?.length || 0
    });

  } catch (error) {
    console.error('[admin-bridge-delete] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur: ${errorMessage}`, 500);
  }
});
