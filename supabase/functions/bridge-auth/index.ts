// ============================================
// Bridge Auth Edge Function
// Handles: create-user, get-auth-token
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  BridgeClient, 
  corsHeaders, 
  errorResponse, 
  successResponse 
} from '../_shared/bridge-client.ts';
import { 
  bridgeAuthRequestSchema, 
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
      // Empty body is OK for default action
    }

    const validation = validateRequest(bridgeAuthRequestSchema, body);
    if (!validation.success) {
      console.error('[bridge-auth] Validation error:', validation.error);
      return validationErrorResponse(validation.error, corsHeaders);
    }

    const { action, bridge_user_uuid } = validation.data;
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
      try {
        const user = await bridgeClient.createUser(userId);
        return successResponse({ user });
      } catch (createError) {
        // Handle 409 - user already exists: fetch existing user instead
        const errorMsg = createError instanceof Error ? createError.message : '';
        if (errorMsg.includes('409') || errorMsg.includes('already_exists')) {
          console.info('[bridge-auth] User already exists, fetching existing user...');
          // Get existing user by external_user_id via Bridge API
          const existingUser = await bridgeClient.getUserByExternalId(userId);
          if (existingUser) {
            return successResponse({ user: existingUser });
          }
        }
        throw createError;
      }
    }

    // ============================================
    // Action: get-auth-token
    // ============================================
    if (action === 'get-auth-token') {
      if (!bridge_user_uuid) {
        return errorResponse('bridge_user_uuid requis');
      }

      const authData = await bridgeClient.getAuthToken(bridge_user_uuid);
      return successResponse({ access_token: authData.access_token, expires_at: authData.expires_at });
    }

    return errorResponse(`Action non reconnue: ${action}`);

  } catch (error) {
    console.error('[bridge-auth] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur Bridge: ${errorMessage}`, 500);
  }
});
