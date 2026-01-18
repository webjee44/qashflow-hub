// ============================================
// Bridge Auth Edge Function
// Handles: create-user, get-auth-token
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  BridgeClient, 
  corsHeaders, 
  jsonResponse, 
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Initialize Bridge client
    const bridgeClient = new BridgeClient();
    if (!bridgeClient.isConfigured()) {
      return errorResponse('Bridge API non configurée. Ajoutez BRIDGE_CLIENT_ID et BRIDGE_CLIENT_SECRET.');
    }

    // Parse request body
    let action = 'get-auth-token';
    let bridgeUserUuid: string | null = null;

    try {
      const body = await req.json();
      action = body.action || 'get-auth-token';
      bridgeUserUuid = body.bridge_user_uuid || null;
    } catch {
      // No body or invalid JSON
    }

    console.info('[bridge-auth] Action:', action);

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
      console.error('[bridge-auth] Auth error:', claimsError);
      return errorResponse('Unauthorized', 401);
    }

    const userId = claimsData.claims.sub as string;
    console.info('[bridge-auth] User authenticated:', userId);

    // ============================================
    // Action: create-user
    // ============================================
    if (action === 'create-user') {
      const user = await bridgeClient.createUser(userId);
      return successResponse({ user });
    }

    // ============================================
    // Action: get-auth-token
    // ============================================
    if (action === 'get-auth-token') {
      if (!bridgeUserUuid) {
        return errorResponse('bridge_user_uuid requis');
      }

      const authData = await bridgeClient.getAuthToken(bridgeUserUuid);
      return successResponse({ access_token: authData.access_token, expires_at: authData.expires_at });
    }

    return errorResponse(`Action non reconnue: ${action}`);

  } catch (error) {
    console.error('[bridge-auth] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur Bridge: ${errorMessage}`, 500);
  }
});
