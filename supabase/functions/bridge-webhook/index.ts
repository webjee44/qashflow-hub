// ============================================
// Bridge Webhook Edge Function
// Receives webhooks from Bridge API and triggers incremental syncs
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, bridge-signature',
};

function getBridgeTransactionDescription(transaction: any): string {
  // Bridge v3: provider_description contains the bank's complete label.
  // clean_description is normalized and can strip terminal/reference identifiers.
  return transaction.provider_description
    || transaction.raw_description
    || transaction.bank_description
    || transaction.description
    || transaction.clean_description
    || 'Transaction Bridge';
}

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

  // Route to the company that currently OWNS this bridge account, using
  // company_bridge_accounts as the single source of truth.
  // We deliberately do NOT use bridge_accounts.company_id here: that
  // column is a legacy fallback (used as a hint for new accounts) and
  // does not reflect post-onboarding reassignments.
  const { data: assignmentsForAccount, error: assignErr } = await supabaseAdmin
    .from('company_bridge_accounts')
    .select('company_id')
    .eq('bridge_account_id', account_id);

  if (assignErr) {
    console.error('[bridge-webhook] Failed to load assignments:', assignErr);
    return { inserted: 0, updated: 0 };
  }

  const targetCompanyIds = (assignmentsForAccount || []).map((r: any) => r.company_id);

  if (targetCompanyIds.length === 0) {
    console.warn(
      `[bridge-webhook] Account ${account_id} has no active company assignment, skipping transaction sync (balance still updated below)`
    );
    // Still update balance so the unassigned account stays fresh
    await supabaseAdmin
      .from('bridge_accounts')
      .update({ balance, updated_at: new Date().toISOString() })
      .eq('bridge_account_id', account_id);
    return { inserted: 0, updated: 0 };
  }

  if (targetCompanyIds.length > 1) {
    console.info(
      `[bridge-webhook] Account ${account_id} is assigned to ${targetCompanyIds.length} companies; transactions will be replicated.`
    );
  }

  // Get last_sync_at from bridge_accounts (used as a watermark, NOT for routing)
  const { data: bridgeAccountRow } = await supabaseAdmin
    .from('bridge_accounts')
    .select('last_sync_at')
    .eq('bridge_account_id', account_id)
    .maybeSingle();
  const last_sync_at = bridgeAccountRow?.last_sync_at ?? null;

  // Resolve owner per target company (each company keeps its own user_id)
  const { data: companyRows, error: companiesErr } = await supabaseAdmin
    .from('companies')
    .select('id, user_id, created_at')
    .in('id', targetCompanyIds);

  if (companiesErr || !companyRows || companyRows.length === 0) {
    console.error(`[bridge-webhook] Companies not found for account ${account_id}`);
    return { inserted: 0, updated: 0 };
  }

  // Get auth token and fetch transactions since last sync (single Bridge call,
  // shared across all target companies).
  await bridgeClient.getAuthToken(user_uuid);

  const sinceDate = last_sync_at
    ? new Date(last_sync_at).toISOString().split('T')[0]
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const transactions = await bridgeClient.fetchTransactionsSince(account_id, sinceDate);

  console.info(`[bridge-webhook] Fetched ${transactions.length} transactions since ${sinceDate}`);

  let totalInserted = 0;

  if (transactions.length > 0) {
    // Get account name once
    const accountInfo = await bridgeClient.fetchAccount(account_id);
    const accountName = accountInfo?.name || null;

    // Upsert per target company (each company has its own row keyed by pennylane_id+company_id)
    for (const company of companyRows) {
      // Per-company cutoff: company.created_at - 3 months
      let filtered = transactions;
      if (company.created_at) {
        const cutoff = new Date(company.created_at);
        cutoff.setMonth(cutoff.getMonth() - 3);
        const cutoffDateStr = cutoff.toISOString().split('T')[0];
        filtered = transactions.filter((t: any) => t.date >= cutoffDateStr);
      }

      if (filtered.length === 0) continue;

      const upsertData = filtered.map((t: any) => ({
        user_id: company.user_id,
        company_id: company.id,
        pennylane_id: `bridge_${t.id}`,
        bridge_account_id: account_id,
        bridge_transaction_id: t.id,
        amount: Math.abs(t.amount),
        description: getBridgeTransactionDescription(t),
        date: t.date,
        type: t.amount < 0 ? 'expense' : 'income',
        bank_account_name: accountName,
        source: 'bridge',
        is_reconciled: false,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError, count } = await supabaseAdmin
        .from('transactions')
        .upsert(upsertData, {
          onConflict: 'pennylane_id',
          count: 'exact',
        });

      if (upsertError) {
        console.error(`[bridge-webhook] Upsert error for company ${company.id}:`, upsertError);
        continue;
      }
      totalInserted += count || filtered.length;
    }
  }

  // Update bridge_accounts with fresh sync time and balance
  await supabaseAdmin
    .from('bridge_accounts')
    .update({
      balance,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('bridge_account_id', account_id);

  // Save balance snapshot for today (one row per assigned company)
  const today = new Date().toISOString().split('T')[0];
  for (const cid of targetCompanyIds) {
    await supabaseAdmin
      .from('bank_balance_snapshots')
      .upsert(
        {
          bridge_account_id: account_id,
          company_id: cid,
          balance,
          snapshot_date: today,
        },
        { onConflict: 'bridge_account_id,snapshot_date' }
      );
  }

  // Recompute bank stats for every assigned company
  for (const cid of targetCompanyIds) {
    const { error: rpcError } = await supabaseAdmin.rpc('recompute_company_bank_stats', {
      p_company_id: cid,
    });
    if (rpcError) {
      console.error(`[bridge-webhook] recompute_company_bank_stats failed for ${cid}:`, rpcError);
    }
  }

  console.info(
    `[bridge-webhook] Synced ${totalInserted} transaction-rows across ${targetCompanyIds.length} companies for account ${account_id}`
  );

  return { inserted: totalInserted, updated: 0 };
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
