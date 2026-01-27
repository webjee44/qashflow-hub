// ============================================
// Bridge API Client - Shared Helper
// Centralizes all Bridge API interactions
// ============================================

export const BRIDGE_API_URL = 'https://api.bridgeapi.io/v3';
export const BRIDGE_VERSION = '2025-01-15';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Interfaces
// ============================================

export interface BridgeAccount {
  id: number;
  name: string;
  balance: number;
  currency_code: string;
  type: string;
  status: string;
  bank_id: number;
  updated_at: string;
  iban: string | null;
  data_access: string;
}

export interface BridgeAccountsResponse {
  resources: BridgeAccount[];
  pagination: {
    next_uri: string | null;
  };
}

export interface BridgeUser {
  uuid: string;
  external_user_id: string;
}

export interface BridgeTransaction {
  id: number;
  clean_description: string;
  bank_description: string;
  raw_description?: string;
  amount: number;
  date: string;
  updated_at: string;
  currency_code: string;
  is_deleted: boolean;
  category_id: number | null;
  account_id: number;
  is_future: boolean;
}

export interface BridgeTransactionsResponse {
  resources: BridgeTransaction[];
  pagination: {
    next_uri: string | null;
  };
}

export interface BridgeAuthToken {
  access_token: string;
  expires_at: string;
}

// ============================================
// Bridge Client Class
// ============================================

export class BridgeClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;

  constructor() {
    this.clientId = Deno.env.get('BRIDGE_CLIENT_ID') || '';
    this.clientSecret = Deno.env.get('BRIDGE_CLIENT_SECRET') || '';
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private getBaseHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Bridge-Version': BRIDGE_VERSION,
      'Client-Id': this.clientId,
      'Client-Secret': this.clientSecret,
    };
  }

  private getAuthHeaders(): HeadersInit {
    if (!this.accessToken) {
      throw new Error('No access token set. Call getAuthToken first.');
    }
    return {
      ...this.getBaseHeaders(),
      'Authorization': `Bearer ${this.accessToken}`,
    };
  }

  // ============================================
  // Authentication Methods
  // ============================================

  async createUser(externalUserId: string): Promise<BridgeUser> {
    console.info('[BridgeClient] Creating user:', externalUserId);
    
    const response = await fetch(`${BRIDGE_API_URL}/aggregation/users`, {
      method: 'POST',
      headers: this.getBaseHeaders(),
      body: JSON.stringify({ external_user_id: externalUserId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BridgeClient] Create user error:', response.status, errorText);
      throw new Error(`Bridge create user failed: ${response.status} - ${errorText}`);
    }

    const user = await response.json() as BridgeUser;
    console.info('[BridgeClient] User created:', user.uuid);
    return user;
  }

  async getAuthToken(userUuid: string): Promise<BridgeAuthToken> {
    console.info('[BridgeClient] Getting auth token for:', userUuid);
    
    const response = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
      method: 'POST',
      headers: this.getBaseHeaders(),
      body: JSON.stringify({ user_uuid: userUuid }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BridgeClient] Auth token error:', response.status, errorText);
      throw new Error(`Bridge auth token failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    console.info('[BridgeClient] Auth token obtained');
    
    return {
      access_token: data.access_token,
      expires_at: data.expires_at,
    };
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  // ============================================
  // Connect Session Methods
  // ============================================

  async createConnectSession(userEmail: string, redirectUrl?: string): Promise<string> {
    console.info('[BridgeClient] Creating connect session for:', userEmail);
    
    // Bridge API 2025-01-15 uses user_email (migrated from prefill_email)
    // See: https://docs.bridgeapi.io/docs/migration-guide-from-2019-to-2025
    const payload: Record<string, string> = {
      user_email: userEmail,
    };
    
    // Add redirect URL if provided - Bridge will redirect here after connection
    if (redirectUrl) {
      payload.redirect_url = redirectUrl;
      console.info('[BridgeClient] Redirect URL set to:', redirectUrl);
    }
    
    console.info('[BridgeClient] Connect session payload:', JSON.stringify(payload));
    
    const response = await fetch(`${BRIDGE_API_URL}/aggregation/connect-sessions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BridgeClient] Connect session error:', response.status, errorText);
      throw new Error(`Bridge connect session failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.info('[BridgeClient] Connect session created');
    return data.url;
  }

  // ============================================
  // Account Methods
  // ============================================

  async fetchAllAccounts(): Promise<BridgeAccount[]> {
    console.info('[BridgeClient] Fetching all accounts...');
    
    const allAccounts: BridgeAccount[] = [];
    let nextUri: string | null = `${BRIDGE_API_URL}/aggregation/accounts?limit=100`;

    while (nextUri) {
      const url = nextUri.startsWith('http') 
        ? nextUri 
        : `https://api.bridgeapi.io${nextUri}`;

      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BridgeClient] Accounts error:', errorText);
        throw new Error(`Bridge accounts failed: ${response.status}`);
      }

      const data = await response.json() as BridgeAccountsResponse;
      const activeAccounts = (data.resources || []).filter(a => a.data_access !== 'disabled');
      allAccounts.push(...activeAccounts);
      nextUri = data.pagination?.next_uri || null;
    }

    console.info(`[BridgeClient] Fetched ${allAccounts.length} accounts`);
    return allAccounts;
  }

  // ============================================
  // Transaction Methods
  // ============================================

  async fetchAllTransactions(sinceDays = 90): Promise<BridgeTransaction[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDays);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    console.info(`[BridgeClient] Fetching transactions since ${sinceDateStr}...`);

    const allTransactions: BridgeTransaction[] = [];
    let nextUri: string | null = `${BRIDGE_API_URL}/aggregation/transactions?limit=100&since=${sinceDateStr}`;

    while (nextUri) {
      const url = nextUri.startsWith('http') 
        ? nextUri 
        : `https://api.bridgeapi.io${nextUri}`;

      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BridgeClient] Transactions error:', errorText);
        throw new Error(`Bridge transactions failed: ${response.status}`);
      }

      const data = await response.json() as BridgeTransactionsResponse;
      const validTransactions = (data.resources || []).filter(
        t => !t.is_deleted && new Date(t.date) <= new Date()
      );
      allTransactions.push(...validTransactions);
      nextUri = data.pagination?.next_uri || null;
    }

    console.info(`[BridgeClient] Fetched ${allTransactions.length} transactions`);
    return allTransactions;
  }

  // ============================================
  // Helper Methods
  // ============================================

  buildAccountNameMap(accounts: BridgeAccount[]): Record<number, string> {
    const map: Record<number, string> = {};
    for (const account of accounts) {
      map[account.id] = account.name;
    }
    return map;
  }

  calculateTotalBalance(accounts: BridgeAccount[]): number {
    return accounts.reduce((sum, account) => sum + account.balance, 0);
  }

  getTransactionDescription(transaction: BridgeTransaction): string {
    return transaction.clean_description 
      || transaction.bank_description 
      || transaction.raw_description 
      || 'Transaction Bridge';
  }

  getTransactionType(transaction: BridgeTransaction): 'income' | 'expense' {
    return transaction.amount >= 0 ? 'income' : 'expense';
  }
}

// ============================================
// Response Helpers
// ============================================

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

export function errorResponse(message: string, status = 400): Response {
  console.error(`[Bridge] Error: ${message}`);
  return jsonResponse({ error: message }, status);
}

export function successResponse(data: Record<string, unknown>): Response {
  return jsonResponse({ success: true, ...data });
}
