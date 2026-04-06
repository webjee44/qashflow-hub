// ============================================
// Bridge Webhook Edge Function
// Receives webhooks from Bridge API and triggers incremental syncs
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, bridge-signature',
};

// ============================================
// HMAC-SHA256 Signature Verification
// ============================================
async function verifyBridgeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) {
    console.warn('[bridge-webhook] No signature header provided');
    return false;
  }

  try {
    // Extract v1= signatures from header (format: v1=XXX,v1=YYY)
    const signatures = signatureHeader
      .split(',')
      .filter(s => s.startsWith('v1='))
      .map(s => s.slice(3).toUpperCase());

    if (signatures.length === 0) {
      console.warn('[bridge-webhook] No v1 signatures found in header');
      return false;
    }

    // Calculate expected signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const isValid = signatures.includes(expectedSignature);
    
    if (!isValid) {
      console.warn('[bridge-webhook] Signature mismatch');
      console.debug('[bridge-webhook] Expected:', expectedSignature);
      console.debug('[bridge-webhook] Received:', signatures);
    }

    return isValid;
  } catch (error) {
    console.error('[bridge-webhook] Signature verification error:', error);
    return false;
  }
}

// ============================================
// Bridge API Client for Incremental Sync
// ============================================
class BridgeClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl = 'https://api.bridgeapi.io/v3';
  private accessToken: string | null = null;

  constructor() {
    this.clientId = Deno.env.get('BRIDGE_CLIENT_ID') || '';
    this.clientSecret = Deno.env.get('BRIDGE_CLIENT_SECRET') || '';
  }

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  async getAuthToken(userUuid: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/connect/users/${userUuid}/access-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': this.clientId,
        'Client-Secret': this.clientSecret,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get auth token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
  }

  async fetchTransactionsSince(accountId: number, sinceDate: string): Promise<any[]> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const allTransactions: any[] = [];
    let cursor: string | null = null;

    do {
      const params = new URLSearchParams({
        account_id: accountId.toString(),
        since: sinceDate,
        limit: '500',
      });
      if (cursor) params.append('after', cursor);

      const response = await fetch(`${this.baseUrl}/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId,
          'Client-Secret': this.clientSecret,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch transactions: ${error}`);
      }

      const data = await response.json();
      allTransactions.push(...(data.resources || []));
      cursor = data.pagination?.next_cursor || null;
    } while (cursor);

    return allTransactions;
  }

  async fetchAccount(accountId: number): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${this.baseUrl}/accounts/${accountId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId,
        'Client-Secret': this.clientSecret,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch account: ${error}`);
    }

    return response.json();
  }
}

// ============================================
// Event Handlers
// ============================================
async function handleAccountUpdated(
  supabaseAdmin: any,
  bridgeClient: BridgeClient,
  content: any
): Promise<{ inserted: number; updated: number }> {
  const { account_id, user_uuid, balance, nb_new_transactions } = content;
  
  console.info(`[bridge-webhook] Processing account.updated for account ${account_id}, ${nb_new_transactions} new transactions`);

  // Skip if no new transactions
  if (nb_new_transactions === 0) {
    console.info('[bridge-webhook] No new transactions, updating balance only');
    
    // Update balance in bridge_accounts
    await supabaseAdmin
      .from('bridge_accounts')
      .update({ balance, updated_at: new Date().toISOString() })
      .eq('bridge_account_id', account_id);
    
    return { inserted: 0, updated: 0 };
  }

  // Get bridge account mapping
  const { data: bridgeAccount, error: accountError } = await supabaseAdmin
    .from('bridge_accounts')
    .select('company_id, last_sync_at')
    .eq('bridge_account_id', account_id)
    .maybeSingle();

  if (accountError || !bridgeAccount) {
    // Account not yet registered - might be a new connection
    console.warn(`[bridge-webhook] Account ${account_id} not found in bridge_accounts, skipping`);
    return { inserted: 0, updated: 0 };
  }

  const { company_id, last_sync_at } = bridgeAccount;

  // Get company owner and created_at for cutoff filtering
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('user_id, created_at')
    .eq('id', company_id)
    .single();

  if (companyError || !company) {
    console.error(`[bridge-webhook] Company ${company_id} not found`);
    return { inserted: 0, updated: 0 };
  }

  // Get auth token and fetch transactions since last sync
  await bridgeClient.getAuthToken(user_uuid);
  
  const sinceDate = last_sync_at 
    ? new Date(last_sync_at).toISOString().split('T')[0]
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const transactions = await bridgeClient.fetchTransactionsSince(account_id, sinceDate);
  
  console.info(`[bridge-webhook] Fetched ${transactions.length} transactions since ${sinceDate}`);

  if (transactions.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  // Get account name
  const accountInfo = await bridgeClient.fetchAccount(account_id);
  const accountName = accountInfo?.name || null;

  // Filter transactions based on company creation date - 3 months
  let filteredTransactions = transactions;
  if (company.created_at) {
    const cutoff = new Date(company.created_at);
    cutoff.setMonth(cutoff.getMonth() - 3);
    const cutoffDateStr = cutoff.toISOString().split('T')[0];
    filteredTransactions = transactions.filter((t: any) => t.date >= cutoffDateStr);
    if (filteredTransactions.length < transactions.length) {
      console.info(`[bridge-webhook] Cutoff filter removed ${transactions.length - filteredTransactions.length} transactions before ${cutoffDateStr}`);
    }
  }

  if (filteredTransactions.length === 0) {
    console.info('[bridge-webhook] No transactions after cutoff filter');
    return { inserted: 0, updated: 0 };
  }

  // Prepare batch upsert data
  const upsertData = filteredTransactions.map((t: any) => ({
    user_id: company.user_id,
    company_id: company_id,
    pennylane_id: `bridge_${t.id}`,
    amount: Math.abs(t.amount),
    description: t.clean_description || t.raw_description || t.description || 'Transaction Bridge',
    date: t.date,
    type: t.amount < 0 ? 'expense' : 'income',
    bank_account_name: accountName,
    source: 'bridge',
    is_reconciled: false,
    updated_at: new Date().toISOString(),
  }));

  // Batch upsert with conflict resolution
  const { error: upsertError, count } = await supabaseAdmin
    .from('transactions')
    .upsert(upsertData, { 
      onConflict: 'pennylane_id',
      count: 'exact'
    });

  if (upsertError) {
    console.error('[bridge-webhook] Upsert error:', upsertError);
    throw upsertError;
  }

  // Update bridge_accounts with new sync time and balance
  await supabaseAdmin
    .from('bridge_accounts')
    .update({ 
      balance,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('bridge_account_id', account_id);

  // Save balance snapshot for today
  const today = new Date().toISOString().split('T')[0];
  await supabaseAdmin
    .from('bank_balance_snapshots')
    .upsert({
      bridge_account_id: account_id,
      company_id: company_id,
      balance,
      snapshot_date: today,
    }, { onConflict: 'bridge_account_id,snapshot_date' });

  // Update company bank balance
  const { data: allAccounts } = await supabaseAdmin
    .from('bridge_accounts')
    .select('balance')
    .eq('company_id', company_id);

  const totalBalance = (allAccounts || []).reduce((sum: number, acc: any) => sum + (Number(acc.balance) || 0), 0);

  await supabaseAdmin
    .from('companies')
    .update({ 
      bank_balance: totalBalance,
      bank_balance_updated_at: new Date().toISOString()
    })
    .eq('id', company_id);

  console.info(`[bridge-webhook] Synced ${count || transactions.length} transactions for account ${account_id}`);

  return { inserted: count || transactions.length, updated: 0 };
}

async function handleAccountCreated(
  supabaseAdmin: any,
  bridgeClient: BridgeClient,
  content: any
): Promise<void> {
  const { account_id, item_id, user_uuid } = content;
  
  console.info(`[bridge-webhook] Processing account.created for account ${account_id}`);

  // Find company by bridge_user_uuid
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('bridge_user_uuid', user_uuid)
    .maybeSingle();

  if (companyError || !company) {
    console.warn(`[bridge-webhook] No company found for user_uuid ${user_uuid}`);
    return;
  }

  // Get account details from Bridge
  await bridgeClient.getAuthToken(user_uuid);
  const accountInfo = await bridgeClient.fetchAccount(account_id);

  // Register account in bridge_accounts
  await supabaseAdmin
    .from('bridge_accounts')
    .upsert({
      company_id: company.id,
      bridge_account_id: account_id,
      bridge_item_id: item_id,
      bridge_user_uuid: user_uuid,
      name: accountInfo?.name || null,
      iban: accountInfo?.iban || null,
      balance: accountInfo?.balance || 0,
      account_type: accountInfo?.type || null,
      status: 'active',
    }, { onConflict: 'bridge_account_id' });

  console.info(`[bridge-webhook] Registered new account ${account_id} for company ${company.id}`);
}

async function handleAccountDeleted(
  supabaseAdmin: any,
  content: any
): Promise<void> {
  const { account_id } = content;
  
  console.info(`[bridge-webhook] Processing account.deleted for account ${account_id}`);

  // Soft-delete: mark account as inactive
  await supabaseAdmin
    .from('bridge_accounts')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('bridge_account_id', account_id);
}

async function handleItemDeleted(
  supabaseAdmin: any,
  content: any
): Promise<void> {
  const { item_id } = content;
  
  console.info(`[bridge-webhook] Processing item.deleted for item ${item_id}`);

  // Mark all accounts from this item as deleted
  await supabaseAdmin
    .from('bridge_accounts')
    .update({ 
      status: 'deleted', 
      item_status: 'deleted',
      item_status_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    })
    .eq('bridge_item_id', item_id);
}

// Map Bridge status code to our status
function mapBridgeStatus(statusCode: number): 'ok' | 'needs_action' | 'error' {
  if (statusCode === 0) return 'ok';
  if ([402, 429, 1003, 1005, 1010].includes(statusCode)) return 'needs_action';
  return 'error';
}

async function handleItemRefreshed(
  supabaseAdmin: any,
  content: any
): Promise<void> {
  const { item_id, status, status_code_info } = content;
  
  const itemStatus = mapBridgeStatus(status);
  console.info(`[bridge-webhook] Processing item.refreshed for item ${item_id}, status: ${status} → ${itemStatus}`);

  // Update all accounts from this item with the new status
  const { error } = await supabaseAdmin
    .from('bridge_accounts')
    .update({ 
      item_status: itemStatus,
      item_status_message: status_code_info || null,
      item_status_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    })
    .eq('bridge_item_id', item_id);

  if (error) {
    console.error(`[bridge-webhook] Error updating item status:`, error);
  } else {
    console.info(`[bridge-webhook] Updated item ${item_id} status to ${itemStatus}`);
  }
}

// ============================================
// Main Handler
// ============================================
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const webhookSecret = Deno.env.get('BRIDGE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[bridge-webhook] BRIDGE_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get raw body for signature verification
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('bridge-signature');

    // Parse payload first to check for TEST_EVENT
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[bridge-webhook] Invalid JSON payload');
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify signature for all events (including TEST_EVENT)
    const isValid = await verifyBridgeSignature(rawBody, signatureHeader, webhookSecret);
    if (!isValid) {
      console.warn('[bridge-webhook] Invalid signature, rejecting request');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, content } = payload;

    console.info(`[bridge-webhook] Received event: ${type}`);
    console.debug('[bridge-webhook] Payload:', JSON.stringify(content));

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const bridgeClient = new BridgeClient();
    if (!bridgeClient.isConfigured()) {
      console.error('[bridge-webhook] Bridge API not configured');
      return new Response(JSON.stringify({ error: 'Bridge API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process event (Bridge allows up to 30s)
    try {
      switch (type) {
        case 'item.account.updated':
          await handleAccountUpdated(supabaseAdmin, bridgeClient, content);
          break;
        case 'item.account.created':
          await handleAccountCreated(supabaseAdmin, bridgeClient, content);
          break;
        case 'item.account.deleted':
          await handleAccountDeleted(supabaseAdmin, content);
          break;
        case 'item.deleted':
          await handleItemDeleted(supabaseAdmin, content);
          break;
        case 'item.refreshed':
          await handleItemRefreshed(supabaseAdmin, content);
          break;
        case 'TEST_EVENT':
          console.info('[bridge-webhook] Test event received successfully');
          break;
        default:
          console.warn(`[bridge-webhook] Unhandled event type: ${type}`);
      }
    } catch (error) {
      console.error(`[bridge-webhook] Error processing ${type}:`, error);
    }

    // Return 200 (Bridge retries on 5xx)
    return new Response(JSON.stringify({ received: true, type }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[bridge-webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
