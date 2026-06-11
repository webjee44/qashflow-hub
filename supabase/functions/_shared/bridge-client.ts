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
  item_id?: number;
  updated_at: string;
  iban: string | null;
  data_access: string;
}

export interface BridgeBank {
  id: number;
  name: string;
  country_code: string;
  logo_url?: string;
}

export interface BridgeItem {
  id: number;
  status: number;
  status_code_info: string | null;
  /** Bridge v3 field. v2 used `bank_id` — kept for backward compat. */
  provider_id?: number;
  /** @deprecated Bridge v2 alias of provider_id. */
  bank_id?: number;
  accounts?: number[];
}

export interface BridgeItemsResponse {
  resources: BridgeItem[];
  pagination: {
    next_uri: string | null;
  };
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
  provider_description?: string;
  bank_description: string;
  raw_description?: string;
  description?: string;
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
// Status Mapping Helper
// ============================================
export function mapBridgeStatus(statusCode: number): 'ok' | 'needs_action' | 'error' {
  // Bridge status codes:
  // 0 = OK
  // 402 = SCA required
  // 429 = Too many requests (temporary)
  // 1003 = Action needed (e.g. password change)
  // Other codes = error
  if (statusCode === 0) return 'ok';
  if ([402, 429, 1003, 1005, 1010].includes(statusCode)) return 'needs_action';
  return 'error';
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

  async deleteUser(userUuid: string): Promise<boolean> {
    console.info('[BridgeClient] Deleting user:', userUuid);
    
    const response = await fetch(`${BRIDGE_API_URL}/aggregation/users/${userUuid}`, {
      method: 'DELETE',
      headers: this.getBaseHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BridgeClient] Delete user error:', response.status, errorText);
      // 404 means user already deleted - treat as success
      if (response.status === 404) {
        console.info('[BridgeClient] User already deleted or not found');
        return true;
      }
      throw new Error(`Bridge delete user failed: ${response.status} - ${errorText}`);
    }

    console.info('[BridgeClient] User deleted successfully');
    return true;
  }

  async getUserByExternalId(externalUserId: string): Promise<BridgeUser | null> {
    console.info('[BridgeClient] Fetching user by external ID:', externalUserId);
    
    const response = await fetch(
      `${BRIDGE_API_URL}/aggregation/users?external_user_id=${encodeURIComponent(externalUserId)}`,
      { headers: this.getBaseHeaders() }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BridgeClient] Get user error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const users = data.resources || data;
    if (Array.isArray(users) && users.length > 0) {
      console.info('[BridgeClient] Found existing user:', users[0].uuid);
      return users[0] as BridgeUser;
    }
    
    return null;
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
    
    // Bridge v2025-01-15 expects callback_url (not redirect_url)
    // callback_url = where Bridge redirects after Connect session completion
    if (redirectUrl) {
      payload.callback_url = redirectUrl;
      console.info('[BridgeClient] Callback URL set to:', redirectUrl);
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

  async createManageSession(itemId: number, redirectUrl?: string): Promise<string> {
    console.info('[BridgeClient] Creating manage session for item:', itemId);
    
    const payload: Record<string, any> = {
      item_id: itemId,
    };
    
    if (redirectUrl) {
      payload.callback_url = redirectUrl;
      console.info('[BridgeClient] Callback URL set to:', redirectUrl);
    }
    
    console.info('[BridgeClient] Manage session payload:', JSON.stringify(payload));
    
    const response = await fetch(`${BRIDGE_API_URL}/aggregation/connect-sessions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BridgeClient] Manage session error:', response.status, errorText);
      throw new Error(`Bridge manage session failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.info('[BridgeClient] Manage session created');
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
  // Item Methods (for connection status)
  // ============================================

  async fetchAllItems(): Promise<BridgeItem[]> {
    console.info('[BridgeClient] Fetching all items...');
    
    const allItems: BridgeItem[] = [];
    let nextUri: string | null = `${BRIDGE_API_URL}/aggregation/items?limit=100`;

    while (nextUri) {
      const url = nextUri.startsWith('http') 
        ? nextUri 
        : `https://api.bridgeapi.io${nextUri}`;

      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BridgeClient] Items error:', errorText);
        throw new Error(`Bridge items failed: ${response.status}`);
      }

      const data = await response.json() as BridgeItemsResponse;
      allItems.push(...(data.resources || []));
      nextUri = data.pagination?.next_uri || null;
    }

    console.info(`[BridgeClient] Fetched ${allItems.length} items`);
    return allItems;
  }

  // ============================================
  // Bank Methods
  // ============================================

  async fetchBank(bankId: number): Promise<BridgeBank | null> {
    console.info(`[BridgeClient] Fetching bank ${bankId}...`);
    
    try {
      const response = await fetch(`${BRIDGE_API_URL}/banks/${bankId}`, {
        headers: this.getBaseHeaders(),
      });

      if (!response.ok) {
        console.error(`[BridgeClient] Bank fetch error: ${response.status}`);
        return null;
      }

      const bank = await response.json() as BridgeBank;
      console.info(`[BridgeClient] Fetched bank: ${bank.name}`);
      return bank;
    } catch (error) {
      console.error('[BridgeClient] Bank fetch error:', error);
      return null;
    }
  }

  async fetchBanks(bankIds: number[]): Promise<Map<number, BridgeBank>> {
    const bankMap = new Map<number, BridgeBank>();
    const uniqueIds = [...new Set(bankIds)];
    
    console.info(`[BridgeClient] Fetching ${uniqueIds.length} unique banks...`);
    
    // Fetch banks in parallel (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const batch = uniqueIds.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(id => this.fetchBank(id)));
      
      results.forEach((bank, index) => {
        if (bank) {
          bankMap.set(batch[index], bank);
        }
      });
    }
    
    console.info(`[BridgeClient] Fetched ${bankMap.size} banks`);
    return bankMap;
  }

  // ============================================
  // Transaction Methods
  // ============================================

  async fetchAllTransactions(sinceDays = 365, cutoffDate?: string): Promise<BridgeTransaction[]> {
    // Use cutoffDate if provided and more recent than sinceDays
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDays);
    let sinceDateStr = sinceDate.toISOString().split('T')[0];

    if (cutoffDate && cutoffDate > sinceDateStr) {
      sinceDateStr = cutoffDate;
      console.info(`[BridgeClient] Using cutoffDate as since parameter: ${sinceDateStr}`);
    }

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

    // Apply cutoffDate filter in-memory (Bridge API doesn't always respect `since`)
    let filtered = allTransactions;
    if (cutoffDate) {
      filtered = allTransactions.filter(t => t.date >= cutoffDate);
      if (filtered.length < allTransactions.length) {
        console.info(`[BridgeClient] Cutoff filter removed ${allTransactions.length - filtered.length} transactions before ${cutoffDate}`);
      }
    }

    console.info(`[BridgeClient] Fetched ${filtered.length} transactions`);
    return filtered;
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
    // Bridge v3 exposes the bank's complete label in provider_description.
    // clean_description is normalized and may remove identifiers required for automation rules.
    return transaction.provider_description
      || transaction.raw_description
      || transaction.bank_description
      || transaction.description
      || transaction.clean_description
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
