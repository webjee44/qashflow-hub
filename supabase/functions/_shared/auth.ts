// ============================================
// Shared authentication & authorization helpers
// ============================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export const unauthorized = (msg = 'Unauthorized') => jsonResponse(401, { error: msg });
export const forbidden = (msg = 'Forbidden') => jsonResponse(403, { error: msg });

export function getEnv() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return { url, anon, service };
}

export function getServiceClient() {
  const { url, service } = getEnv();
  return createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Verify the caller's JWT. Returns user id or null. */
export async function requireUser(req: Request): Promise<{ userId: string; authHeader: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { url, anon } = getEnv();
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { userId: data.claims.sub as string, authHeader };
}

/** Verify the caller is a superadmin (via user_roles table). */
export async function requireSuperadmin(req: Request): Promise<{ userId: string } | null> {
  const auth = await requireUser(req);
  if (!auth) return null;
  const admin = getServiceClient();
  const { data, error } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', auth.userId)
    .eq('role', 'superadmin')
    .maybeSingle();
  if (error || !data) return null;
  return { userId: auth.userId };
}

/** Verify the caller has access to the given company. */
export async function userHasCompanyAccess(userId: string, companyId: string): Promise<boolean> {
  const admin = getServiceClient();
  const { data, error } = await admin.rpc('has_company_access', {
    _user_id: userId,
    _company_id: companyId,
  });
  if (error) {
    console.error('[auth] has_company_access error:', error);
    return false;
  }
  return data === true;
}

/** Verify the request carries the shared cron secret. Accepts either the
 *  CRON_SECRET env var (Lovable-managed) or a value matching the DB-stored
 *  `private.app_secrets.cron_secret` row, allowing pg_cron jobs to embed the
 *  secret without us syncing two systems. */
export async function requireCronSecret(req: Request): Promise<boolean> {
  const headerSecret =
    req.headers.get('X-Cron-Secret') ??
    (req.headers.get('Authorization')?.startsWith('Bearer ')
      ? req.headers.get('Authorization')!.slice(7)
      : null);
  if (!headerSecret) return false;

  const envSecret = Deno.env.get('CRON_SECRET');
  if (envSecret && headerSecret === envSecret) return true;

  // Fallback: verify against DB-stored cron secret via SECURITY DEFINER RPC
  try {
    const admin = getServiceClient();
    const { data, error } = await admin.rpc('verify_cron_secret', { _token: headerSecret });
    if (error) {
      console.error('[auth] verify_cron_secret error:', error);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error('[auth] verify_cron_secret threw:', e);
    return false;
  }
}
