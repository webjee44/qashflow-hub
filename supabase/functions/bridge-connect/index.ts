// ============================================
// Bridge Connect Edge Function
// Handles: create-connect-session
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Initialize Bridge client
    const bridgeClient = new BridgeClient();
    if (!bridgeClient.isConfigured()) {
      return errorResponse('Bridge API non configurée. Ajoutez BRIDGE_CLIENT_ID et BRIDGE_CLIENT_SECRET.');
    }

    // Parse request body
    let bridgeUserUuid: string | null = null;

    try {
      const body = await req.json();
      bridgeUserUuid = body.bridge_user_uuid || null;
    } catch {
      // No body or invalid JSON
    }

    console.info('[bridge-connect] Creating connect session...');

    if (!bridgeUserUuid) {
      return errorResponse('bridge_user_uuid requis');
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
      console.error('[bridge-connect] Auth error:', claimsError);
      return errorResponse('Unauthorized', 401);
    }

    const userEmail = claimsData.claims.email as string;
    console.info('[bridge-connect] User email:', userEmail);

    // Get auth token first
    const authData = await bridgeClient.getAuthToken(bridgeUserUuid);
    bridgeClient.setAccessToken(authData.access_token);

    // Create connect session
    const connectUrl = await bridgeClient.createConnectSession(userEmail);

    return successResponse({ connect_url: connectUrl });

  } catch (error) {
    console.error('[bridge-connect] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur Bridge: ${errorMessage}`, 500);
  }
});
