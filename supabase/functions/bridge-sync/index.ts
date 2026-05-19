// ============================================
// Bridge Sync Edge Function
// Handles: full-sync, cron-sync
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  BridgeClient, 
  BridgeAccount,
  BridgeTransaction,
  BridgeItem,
  mapBridgeStatus,
  corsHeaders, 
  errorResponse, 
  successResponse 
} from '../_shared/bridge-client.ts';
import { 
  bridgeSyncRequestSchema, 
  validateRequest, 
  validationErrorResponse 
} from '../_shared/validation.ts';
import { deriveTransactionNormalization } from '../_shared/merchantNormalizer.ts';

function publicComputeAccountIdentity(iban: string | null | undefined, name: string | null | undefined, accountType: string | null | undefined): string {
  const normalizedIban = (iban || '').toLowerCase().replace(/\s+/g, '');
  if (normalizedIban) return normalizedIban;
  return `fallback:${(name || '').toLowerCase()}:${(accountType || '').toLowerCase()}`;
}

// ============================================
// Helper: Build account_id -> company_id map
// ============================================
async function getAccountToCompanyMap(
  supabaseAdmin: any,
  bridgeUserUuid: string
): Promise<Record<number, string>> {
  // Get all bridge accounts for this bridge_user_uuid
  const { data: bridgeAccounts } = await supabaseAdmin
    .from('bridge_accounts')
    .select('bridge_account_id')
    .eq('bridge_user_uuid', bridgeUserUuid);

  if (!bridgeAccounts || bridgeAccounts.length === 0) {
    return {};
  }

  const accountIds = bridgeAccounts.map((a: { bridge_account_id: number }) => a.bridge_account_id);

  // Get only active company assignments for these accounts.
  // Excluded rows are persistent user decisions: they must keep the account
  // visible for audit/settings, but must never route transactions again.
  const { data: assignments } = await supabaseAdmin
    .from('company_bridge_accounts')
    .select('bridge_account_id, company_id')
    .in('bridge_account_id', accountIds)
    .eq('status', 'active');

  const map: Record<number, string> = {};
  for (const row of assignments || []) {
    map[row.bridge_account_id] = row.company_id;
  }

  console.info(`[bridge-sync] Account→Company map: ${Object.keys(map).length} mappings found`);
  return map;
}

// ============================================
// Helper: Recompute company bank stats via RPC
// ----
// Single source of truth: company_bridge_accounts JOIN bridge_accounts.
// The DB function + triggers handle the actual computation; we just trigger
// it explicitly here to guarantee freshness right after a sync.
// ============================================
async function recomputeCompanyStats(supabaseAdmin: any, companyId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('recompute_company_bank_stats', {
    p_company_id: companyId,
  });
  if (error) {
    console.error(`[bridge-sync] recompute_company_bank_stats failed for ${companyId}:`, error);
  }
}

// ============================================
// Helper: Sync transactions for a company
// ============================================
async function syncBridgeAccounts(
  supabaseAdmin: any,
  bridgeClient: BridgeClient,
  fallbackCompanyId: string,
  bridgeUserUuid: string,
  accounts: BridgeAccount[],
  items?: BridgeItem[]
): Promise<number> {
  let syncedCount = 0;

  // Build item status map
  const itemStatusMap = new Map<number, { status: string; message: string | null }>();
  if (items) {
    for (const item of items) {
      itemStatusMap.set(item.id, {
        status: mapBridgeStatus(item.status),
        message: item.status_code_info,
      });
    }
  }

  // CRITICAL FIX: Build account→company map from company_bridge_accounts
  // so each account gets its CORRECT company_id, not the triggering company
  const accountIds = accounts.map(a => a.id);
  const { data: assignments } = await supabaseAdmin
    .from('company_bridge_accounts')
    .select('bridge_account_id, company_id')
    .in('bridge_account_id', accountIds)
    .eq('status', 'active');

  const assignmentMap: Record<number, string> = {};
  for (const row of assignments || []) {
    assignmentMap[row.bridge_account_id] = row.company_id;
  }

  // Also get existing bridge_accounts company_id to avoid overwriting with fallback
  const { data: existingAccounts } = await supabaseAdmin
    .from('bridge_accounts')
    .select('bridge_account_id, company_id')
    .in('bridge_account_id', accountIds);

  const existingCompanyMap: Record<number, string> = {};
  for (const row of existingAccounts || []) {
    existingCompanyMap[row.bridge_account_id] = row.company_id;
  }

  // -------- Deduplication on reconnect --------
  // Bridge creates a new account_id whenever a bank connection is re-established.
  // We detect that case by matching IBAN within the same bridge_user_uuid and:
  //  - move the company assignment to the new account_id
  //  - move existing transactions to the new account_id
  //  - mark the old account as ignored (kept for history/audit)
  const incomingIbans = accounts
    .filter(a => a.iban)
    .map(a => ({ id: a.id, iban: (a.iban || '').toUpperCase().replace(/\s+/g, '') }));

  if (incomingIbans.length > 0) {
    const { data: sameUuidAccounts } = await supabaseAdmin
      .from('bridge_accounts')
      .select('bridge_account_id, iban, account_type, bank_id, item_status, last_sync_at, lifecycle_status')
      .eq('bridge_user_uuid', bridgeUserUuid);

    // Index existing accounts by composite fingerprint (IBAN normalisé)
    type ExistingRow = {
      bridge_account_id: number;
      iban: string;
      account_type: string | null;
      bank_id: number | null;
      item_status: string | null;
      last_sync_at: string | null;
      lifecycle_status: string | null;
    };
    const existingByIban = new Map<string, ExistingRow[]>();
    for (const row of (sameUuidAccounts as ExistingRow[] | null) || []) {
      if (!row.iban) continue;
      const key = row.iban.toUpperCase().replace(/\s+/g, '');
      const list = existingByIban.get(key) || [];
      list.push(row);
      existingByIban.set(key, list);
    }

    // Build incoming map for fingerprint
    const incomingByAccountId = new Map<number, BridgeAccount>();
    for (const a of accounts) incomingByAccountId.set(a.id, a);

    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    for (const incoming of incomingIbans) {
      const candidates = (existingByIban.get(incoming.iban) || []).filter(c => c.bridge_account_id !== incoming.id);
      if (candidates.length === 0) continue;
      const incomingAccount = incomingByAccountId.get(incoming.id);
      if (!incomingAccount) continue;
      const incomingType = (incomingAccount as any).account_type || (incomingAccount as any).type || null;

      for (const old of candidates) {
        if (old.lifecycle_status !== 'active') continue; // déjà décidé

        // Fingerprint fort: même IBAN + même type
        const sameFingerprint = (old.account_type || null) === incomingType;

        // Confiance haute: ancien item KO (refresh failed/disabled) OU pas de sync depuis 14j
        const itemKo = old.item_status && !['ok', null, 'active'].includes(old.item_status);
        const stale = old.last_sync_at
          ? Date.now() - new Date(old.last_sync_at).getTime() > FOURTEEN_DAYS_MS
          : true;
        const highConfidence = sameFingerprint && (itemKo || stale);

        if (!highConfidence) {
          // Doublon suspect — on marque sans toucher au statut. UI affichera un bandeau.
          console.warn(`[bridge-sync][dedup] Suspicious duplicate IBAN ${incoming.iban}: old=${old.bridge_account_id} new=${incoming.id} (no auto-replace)`);
          await supabaseAdmin
            .from('bridge_accounts')
            .update({
              duplicate_confidence: 0.5,
              duplicate_reason: `Même IBAN que ${incoming.id}, mais ancien item encore actif récemment — validation manuelle requise`,
              updated_at: new Date().toISOString(),
            })
            .eq('bridge_account_id', old.bridge_account_id);
          continue;
        }

        console.info(`[bridge-sync][dedup] Auto-replace IBAN ${incoming.iban}: ${old.bridge_account_id} → ${incoming.id} (itemKo=${itemKo}, stale=${stale})`);

        // Migrer les assignations vers le nouveau bridge_account_id
        const { data: existingForNew } = await supabaseAdmin
          .from('company_bridge_accounts')
          .select('company_id')
          .eq('bridge_account_id', incoming.id);
        const existingCompanies = new Set((existingForNew || []).map((r: any) => r.company_id));

        const { data: oldMappings } = await supabaseAdmin
          .from('company_bridge_accounts')
          .select('company_id, status, excluded_at, excluded_by, exclusion_reason')
          .eq('bridge_account_id', old.bridge_account_id);

        const excludedMappings = (oldMappings || []).filter((m: any) => m.status === 'excluded');
        if (excludedMappings.length > 0) {
          await supabaseAdmin
            .from('company_bridge_account_identity_exclusions')
            .upsert(
              excludedMappings.map((m: any) => ({
                company_id: m.company_id,
                bridge_user_uuid: bridgeUserUuid,
                account_identity: incoming.iban.toLowerCase(),
                account_type: incomingType,
                reason: m.exclusion_reason || 'Compte exclu durablement',
                excluded_by: m.excluded_by,
              })),
              { onConflict: 'company_id,account_identity' },
            );
        }

        const toCreate = (oldMappings || [])
          .filter((m: any) => !existingCompanies.has(m.company_id))
          .map((m: any) => ({
            company_id: m.company_id,
            bridge_account_id: incoming.id,
            // Préserver une décision d'exclusion existante
            status: m.status || 'active',
            excluded_at: m.excluded_at,
            excluded_by: m.excluded_by,
            exclusion_reason: m.exclusion_reason,
          }));

        if (toCreate.length > 0) {
          await supabaseAdmin.from('company_bridge_accounts').insert(toCreate);
        }
        await supabaseAdmin
          .from('company_bridge_accounts')
          .delete()
          .eq('bridge_account_id', old.bridge_account_id);

        // Re-point transactions via clé forte (jamais via bank_account_name)
        await supabaseAdmin
          .from('transactions')
          .update({ bridge_account_id: incoming.id })
          .eq('bridge_account_id', old.bridge_account_id);

        // Marquer l'ancien comme replaced (état technique) + référence au remplaçant
        await supabaseAdmin
          .from('bridge_accounts')
          .update({
            lifecycle_status: 'replaced',
            replaced_by_bridge_account_id: incoming.id,
            duplicate_confidence: 1,
            duplicate_reason: itemKo ? 'item KO + même IBAN' : 'inactif >14j + même IBAN',
            updated_at: new Date().toISOString(),
          })
          .eq('bridge_account_id', old.bridge_account_id);

        // Rafraîchir les maps locales pour le reste du run
        if (assignmentMap[old.bridge_account_id] && !assignmentMap[incoming.id]) {
          assignmentMap[incoming.id] = assignmentMap[old.bridge_account_id];
        }
        delete assignmentMap[old.bridge_account_id];
      }
    }
  }

  const getItemId = (account: BridgeAccount): number | null => {
    const anyAccount = account as any;
    const candidate =
      anyAccount.item_id ??
      anyAccount.bridge_item_id ??
      anyAccount.bank_id ??
      anyAccount.bank?.id;

    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
  };

  for (const account of accounts) {
    const itemId = getItemId(account);
    if (!itemId) {
      console.error('[bridge-sync] Missing item id for account (cannot upsert due to NOT NULL bridge_item_id):', account);
      continue;
    }

    // Get item status for this account
    const itemStatus = itemStatusMap.get(itemId);

    // Determine correct company_id:
    // 1. Use company_bridge_accounts assignment if exists (most authoritative)
    // 2. Keep existing company_id from bridge_accounts if already set
    // 3. Fall back to the triggering company_id only for new accounts
    const correctCompanyId = assignmentMap[account.id] 
      || existingCompanyMap[account.id] 
      || fallbackCompanyId;

    const { error } = await supabaseAdmin
      .from('bridge_accounts')
      .upsert({
        bridge_account_id: account.id,
        bridge_item_id: itemId,
        bridge_user_uuid: bridgeUserUuid,
        company_id: correctCompanyId,
        name: account.name || null,
        iban: account.iban || null,
        balance: account.balance || 0,
        account_type: account.type || null,
        status: account.status || 'active',
        bank_id: account.bank_id || null,
        // Item connection status
        item_status: itemStatus?.status || 'ok',
        item_status_message: itemStatus?.message || null,
        item_status_updated_at: new Date().toISOString(),
        // IMPORTANT: bank_name is 100% manual.
        // We do NOT fetch or set it from Bridge to avoid overwriting user edits.
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'bridge_account_id',
        ignoreDuplicates: false 
      });

    if (!error) syncedCount++;
    else console.error('[bridge-sync] Failed to upsert account:', error);
  }

  console.info(`[bridge-sync] Synced ${syncedCount}/${accounts.length} bridge accounts`);
  return syncedCount;
}

/**
 * Resolve the applicative owner (user_id) for a given target company.
 * The user_id stored on the transaction MUST be the owner of the target
 * company, not inherited from a "trigger" company. This is the only way
 * to keep ownership consistent when a Bridge user UUID is shared across
 * several companies (e.g. a holding's Bridge connection feeding multiple
 * subsidiaries).
 */
async function resolveCompanyOwners(
  supabaseAdmin: any,
  companyIds: string[]
): Promise<Record<string, string>> {
  if (companyIds.length === 0) return {};
  const { data: rows } = await supabaseAdmin
    .from('companies')
    .select('id, user_id')
    .in('id', companyIds);
  const map: Record<string, string> = {};
  for (const r of rows || []) {
    map[r.id] = r.user_id;
  }
  return map;
}

async function syncCompanyTransactions(
  supabaseAdmin: any,
  bridgeClient: BridgeClient,
  fallbackUserId: string,
  accounts: BridgeAccount[],
  transactions: BridgeTransaction[],
  accountToCompanyMap: Record<number, string>
): Promise<{ inserted: number; updated: number }> {
  const accountNameMap = bridgeClient.buildAccountNameMap(accounts);
  let insertedCount = 0;
  let updatedCount = 0;

  // Batch transactions by company for efficiency
  const txByCompany = new Map<string, BridgeTransaction[]>();
  for (const transaction of transactions) {
    const targetCompanyId = accountToCompanyMap[transaction.account_id];
    if (!targetCompanyId) continue; // Skip unassigned accounts
    if (!txByCompany.has(targetCompanyId)) txByCompany.set(targetCompanyId, []);
    txByCompany.get(targetCompanyId)!.push(transaction);
  }

  // Resolve the applicative owner per target company so each inserted
  // transaction gets the correct user_id (not the one of a "trigger"
  // company that happens to share the same bridge_user_uuid).
  const ownerByCompany = await resolveCompanyOwners(
    supabaseAdmin,
    Array.from(txByCompany.keys())
  );

  console.info(`[bridge-sync] Processing transactions for ${txByCompany.size} companies`);

  for (const [correctCompanyId, companyTransactions] of txByCompany) {
    // Get existing bridge_transaction_ids for this company in one query
    const bridgeIds = companyTransactions.map(t => t.id);
    const { data: existingTxs } = await supabaseAdmin
      .from('transactions')
      .select('id, bridge_transaction_id, pennylane_id')
      .eq('company_id', correctCompanyId)
      .or(
        `bridge_transaction_id.in.(${bridgeIds.join(',')}),` +
        `pennylane_id.in.(${bridgeIds.map(id => `bridge_${id}`).join(',')})`
      );

    // Build lookup maps
    const existingByBridgeId = new Map<number, string>();
    const existingByPennylaneId = new Map<string, string>();
    for (const tx of existingTxs || []) {
      if (tx.bridge_transaction_id) existingByBridgeId.set(tx.bridge_transaction_id, tx.id);
      if (tx.pennylane_id) existingByPennylaneId.set(tx.pennylane_id, tx.id);
    }

    // Pre-fetch ALL existing transactions for this company for in-memory signature matching
    // This replaces per-transaction DB queries and prevents timeout
    const { data: allExistingTxs } = await supabaseAdmin
      .from('transactions')
      .select('id, description, date, amount, type, bank_account_name')
      .eq('company_id', correctCompanyId)
      .is('deleted_at', null)
      .limit(10000);

    // Build signature lookup: "description|date|amount|type|bank_account_name" -> id
    const signatureMap = new Map<string, string>();
    for (const tx of allExistingTxs || []) {
      const sig = `${tx.description}|${tx.date}|${tx.amount}|${tx.type}|${tx.bank_account_name || ''}`;
      signatureMap.set(sig, tx.id);
    }

    // Batch inserts and updates
    const toInsert: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];

    for (const transaction of companyTransactions) {
      const transactionType = bridgeClient.getTransactionType(transaction);
      const accountName = accountNameMap[transaction.account_id] || null;
      const description = bridgeClient.getTransactionDescription(transaction);
      const absAmount = Math.abs(transaction.amount);

      // TEMP DEBUG: dump raw Bridge fields for "Remise CB" to identify which field carries the full label
      const anyTx = transaction as any;
      const candidateLabels = [
        anyTx.provider_description,
        anyTx.raw_description,
        anyTx.bank_description,
        anyTx.description,
        anyTx.clean_description,
      ].filter(Boolean).join(' | ');
      if (candidateLabels.toUpperCase().includes('REMISE CB')) {
        console.info(`[bridge-sync][DEBUG REMISE_CB] id=${transaction.id} account=${accountName} fields=${JSON.stringify({
          provider_description: anyTx.provider_description,
          raw_description: anyTx.raw_description,
          bank_description: anyTx.bank_description,
          description: anyTx.description,
          clean_description: anyTx.clean_description,
        })}`);
      }

      // Check if already exists by bridge_transaction_id OR legacy pennylane_id
      let existingId = existingByBridgeId.get(transaction.id) 
        || existingByPennylaneId.get(`bridge_${transaction.id}`);

      // Phase 3: In-memory signature match (replaces per-tx DB query)
      if (!existingId) {
        const sig = `${description}|${transaction.date}|${absAmount}|${transactionType}|${accountName || ''}`;
        const matchId = signatureMap.get(sig);
        if (matchId) {
          existingId = matchId;
        }
      }

      if (existingId) {
        const norm = deriveTransactionNormalization(description);
        toUpdate.push({
          id: existingId,
          data: {
            amount: absAmount,
            description,
            date: transaction.date,
            type: transactionType,
            bank_account_name: accountName,
            bridge_account_id: transaction.account_id,
            source: 'bridge',
            bridge_transaction_id: transaction.id,
            company_id: correctCompanyId,
            merchant_key: norm.merchant_key,
            normalized_description: norm.normalized_description,
            updated_at: new Date().toISOString(),
          }
        });
      } else {
        const norm = deriveTransactionNormalization(description);
        toInsert.push({
          user_id: ownerByCompany[correctCompanyId] ?? fallbackUserId,
          company_id: correctCompanyId,
          bridge_transaction_id: transaction.id,
          pennylane_id: `bridge_${transaction.id}`,
          amount: absAmount,
          description,
          date: transaction.date,
          type: transactionType,
          bank_account_name: accountName,
          bridge_account_id: transaction.account_id,
          source: 'bridge',
          merchant_key: norm.merchant_key,
          normalized_description: norm.normalized_description,
          is_reconciled: false,
        });
      }
    }

    // Batch insert new transactions with individual fallback on failure
    if (toInsert.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin.from('transactions').insert(batch);
        if (!error) {
          insertedCount += batch.length;
        } else {
          // Batch failed (likely duplicate trigger) - fall back to individual inserts
          console.warn(`[bridge-sync] Batch insert failed: ${error.message}. Falling back to individual inserts for ${batch.length} transactions.`);
          for (const tx of batch) {
            const { error: singleError } = await supabaseAdmin.from('transactions').insert(tx);
            if (!singleError) {
              insertedCount++;
            } else {
              // Skip this duplicate silently (expected for duplicates)
              console.debug(`[bridge-sync] Skipped duplicate: ${tx.description} ${tx.date} ${tx.amount}`);
            }
          }
        }
      }
    }

    // Batch update existing transactions in parallel chunks
    const UPDATE_BATCH_SIZE = 50;
    for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + UPDATE_BATCH_SIZE);
      const results = await Promise.all(
        batch.map(item =>
          supabaseAdmin
            .from('transactions')
            .update(item.data)
            .eq('id', item.id)
        )
      );
      updatedCount += results.filter(r => !r.error).length;
    }

    console.info(`[bridge-sync] Company ${correctCompanyId}: ${toInsert.length} new, ${toUpdate.length} updated`);
  }

  return { inserted: insertedCount, updated: updatedCount };
}

// ============================================
// Main Handler
// ============================================
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Initialize Bridge client
    const bridgeClient = new BridgeClient();
    if (!bridgeClient.isConfigured()) {
      return errorResponse('Bridge API non configurée. Ajoutez BRIDGE_CLIENT_ID et BRIDGE_CLIENT_SECRET.');
    }

    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body - will use defaults
    }

    const validation = validateRequest(bridgeSyncRequestSchema, body);
    if (!validation.success) {
      console.error('[bridge-sync] Validation error:', validation.error);
      return validationErrorResponse(validation.error, corsHeaders);
    }

    const { action, bridge_user_uuid, company_id, since_days } = validation.data;
    console.info('[bridge-sync] Action:', action, since_days ? `(since_days override: ${since_days})` : '');

    // ============================================
    // Action: cron-sync (No user auth required)
    //
    // Source of truth = company_bridge_accounts JOIN bridge_accounts.
    //
    // We do NOT iterate on companies.bridge_user_uuid: that field is just
    // the historical "owner" of a Bridge connection and is not reliable
    // (a Bridge user UUID can be shared across several companies via
    // company_bridge_accounts, and the original owner company may have
    // been deleted, leaving the UUID orphan but still in active use).
    //
    // Instead, we iterate on every distinct bridge_user_uuid that has at
    // least one account currently assigned to an active company. This
    // guarantees no Bridge connection in active use can fall off the
    // radar, regardless of who originally connected it.
    // ============================================
    if (action === 'cron-sync') {
      console.info('[bridge-sync] Starting cron sync (driven by company_bridge_accounts)...');

      // 1. Find every assigned bridge_account on an active company
      const { data: activeAssignments, error: assignErr } = await supabaseAdmin
        .from('company_bridge_accounts')
        .select('bridge_account_id, company_id, companies!inner(deleted_at)')
        .eq('status', 'active')
        .is('companies.deleted_at', null);

      if (assignErr) {
        console.error('[bridge-sync] Failed to fetch active assignments:', assignErr);
        return errorResponse('Failed to fetch assignments', 500);
      }

      const assignedAccountIds = Array.from(
        new Set((activeAssignments || []).map((a: any) => a.bridge_account_id))
      );

      if (assignedAccountIds.length === 0) {
        console.info('[bridge-sync] No assigned bridge accounts on active companies');
        return successResponse({ synced: 0 });
      }

      // 2. Resolve the distinct bridge_user_uuid that powers those accounts
      const { data: ownersRows, error: ownersErr } = await supabaseAdmin
        .from('bridge_accounts')
        .select('bridge_user_uuid')
        .in('bridge_account_id', assignedAccountIds)
        .not('bridge_user_uuid', 'is', null);

      if (ownersErr) {
        console.error('[bridge-sync] Failed to fetch bridge accounts owners:', ownersErr);
        return errorResponse('Failed to fetch bridge accounts owners', 500);
      }

      let bridgeUserUuids = Array.from(
        new Set((ownersRows || []).map((r: any) => r.bridge_user_uuid).filter(Boolean))
      );

      // Optional targeted sync: when a specific bridge_user_uuid is passed,
      // restrict the cron loop to that single UUID. Used by the future
      // per-UUID worker pattern and by ops to unblock a single connection
      // without re-running the full cron (which can hit CPU limits).
      if (bridge_user_uuid) {
        if (!bridgeUserUuids.includes(bridge_user_uuid)) {
          console.warn(
            `[bridge-sync] Targeted bridge_user_uuid ${bridge_user_uuid} is not in active use, skipping`
          );
          return successResponse({ synced: 0, targeted: bridge_user_uuid });
        }
        bridgeUserUuids = [bridge_user_uuid];
      }

      console.info(
        `[bridge-sync] Found ${bridgeUserUuids.length} distinct bridge_user_uuid(s) to sync` +
          (bridge_user_uuid ? ` (targeted: ${bridge_user_uuid})` : '')
      );

      let syncedUuidCount = 0;
      let totalTransactions = 0;
      const touchedCompanyIds = new Set<string>();

      for (const bridgeUserUuid of bridgeUserUuids) {
        try {
          console.info(`[bridge-sync] Syncing bridge_user_uuid ${bridgeUserUuid}...`);

          await bridgeClient.getAuthToken(bridgeUserUuid);

          const allAccounts = await bridgeClient.fetchAllAccounts();
          const allItems = await bridgeClient.fetchAllItems();

          console.info(`[bridge-raw-dump] user=${bridgeUserUuid} count=${allAccounts.length}`);

          // Build the account→company map BEFORE syncing accounts so we can
          // pick a sensible fallback company for newly discovered accounts.
          const accountToCompanyMap = await getAccountToCompanyMap(
            supabaseAdmin,
            bridgeUserUuid
          );

          // Fallback only used by syncBridgeAccounts for the legacy
          // bridge_accounts.company_id column. Real routing happens via
          // company_bridge_accounts.
          const fallbackCompanyId = Object.values(accountToCompanyMap)[0] ?? null;

          if (!fallbackCompanyId) {
            console.warn(
              `[bridge-sync] No assigned company for bridge_user_uuid ${bridgeUserUuid}, skipping.`
            );
            continue;
          }

          await syncBridgeAccounts(
            supabaseAdmin,
            bridgeClient,
            fallbackCompanyId,
            bridgeUserUuid,
            allAccounts,
            allItems
          );

          // Recompute stats for every company impacted by these accounts
          const impactedCompanyIds = Array.from(
            new Set(
              allAccounts
                .map((a) => accountToCompanyMap[a.id])
                .filter((id): id is string => !!id)
            )
          );
          for (const cid of impactedCompanyIds) {
            await recomputeCompanyStats(supabaseAdmin, cid);
            touchedCompanyIds.add(cid);
          }

          // Cutoff: oldest impacted company.created_at minus 1 month
          let cutoffDateStr: string | undefined;
          if (impactedCompanyIds.length > 0) {
            const { data: createdRows } = await supabaseAdmin
              .from('companies')
              .select('created_at')
              .in('id', impactedCompanyIds)
              .order('created_at', { ascending: true })
              .limit(1);
            const oldest = createdRows?.[0]?.created_at;
            if (oldest) {
              const cutoff = new Date(oldest);
              cutoff.setMonth(cutoff.getMonth() - 1);
              cutoffDateStr = cutoff.toISOString().split('T')[0];
            }
          }

          const allTransactions = await bridgeClient.fetchAllTransactions(
            since_days ?? 365,
            cutoffDateStr
          );

          // Fallback user_id only used if a target company has no resolvable owner
          const { data: fallbackOwnerRow } = await supabaseAdmin
            .from('companies')
            .select('user_id')
            .eq('id', fallbackCompanyId)
            .maybeSingle();
          const fallbackUserId = fallbackOwnerRow?.user_id ?? '';

          const { inserted, updated } = await syncCompanyTransactions(
            supabaseAdmin,
            bridgeClient,
            fallbackUserId,
            allAccounts,
            allTransactions,
            accountToCompanyMap
          );

          syncedUuidCount++;
          totalTransactions += inserted + updated;
          console.info(
            `[bridge-sync] bridge_user_uuid ${bridgeUserUuid} synced: ` +
              `${allAccounts.length} accounts, ${impactedCompanyIds.length} companies, ` +
              `${inserted} new, ${updated} updated transactions`
          );

          // Apply automation rules per impacted company when new transactions came in
          // Trigger on inserts OR updates: Bridge frequently marks settled/pending
          // transitions as "updated", and signature-based dedup can also bucket
          // genuinely new transactions there. apply-all is idempotent (uncategorized only).
          if (inserted > 0 || updated > 0) {
            for (const cid of impactedCompanyIds) {
              try {
                const applyRes = await fetch(
                  `${supabaseUrl}/functions/v1/apply-all-automation-rules`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({ company_id: cid }),
                  }
                );
                const applyData = await applyRes.json();
                console.info(
                  `[bridge-sync] Auto-categorized ${applyData.updated || 0} transactions for company ${cid}`
                );
              } catch (autoErr) {
                console.error(
                  `[bridge-sync] Failed to apply automation rules for company ${cid}:`,
                  autoErr
                );
              }
            }
          }
        } catch (err) {
          console.error(
            `[bridge-sync] Error syncing bridge_user_uuid ${bridgeUserUuid}:`,
            err
          );
        }
      }

      console.info(
        `[bridge-sync] Cron sync complete: ${syncedUuidCount} bridge_user_uuid(s), ` +
          `${touchedCompanyIds.size} companies touched, ${totalTransactions} transactions`
      );

      return successResponse({
        synced: syncedUuidCount,
        companies_touched: touchedCompanyIds.size,
        totalTransactions,
      });
    }

    // ============================================
    // Action: full-sync (User auth required)
    // ============================================
    if (action === 'sync-accounts' || action === 'full-sync') {
      if (!bridge_user_uuid || !company_id) {
        return errorResponse('bridge_user_uuid et company_id requis');
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
        console.error('[bridge-sync] Auth error:', claimsError);
        return errorResponse('Unauthorized', 401);
      }

      const userId = claimsData.claims.sub as string;
      console.info(`[bridge-sync] Starting ${action} for user:`, userId);

      // Get auth token
      await bridgeClient.getAuthToken(bridge_user_uuid);

      // Get accounts, balances and items (for status)
      const allAccounts = await bridgeClient.fetchAllAccounts();
      const allItems = await bridgeClient.fetchAllItems();
      console.info(`[bridge-sync] Fetched ${allAccounts.length} accounts and ${allItems.length} items from Bridge`);

      // [BRIDGE-RAW-DUMP] Temporary diagnostic: log raw Bridge accounts for this user
      console.info(`[bridge-raw-dump] user=${bridge_user_uuid} company=${company_id} count=${allAccounts.length}`);
      for (const a of allAccounts as any[]) {
        console.info(`[bridge-raw-dump] account id=${a.id} name="${a.name}" iban=${(a.iban || '').slice(-6)} balance=${a.balance} bank_id=${a.bank_id ?? a.item?.bank_id} item_id=${a.item_id ?? a.item?.id} type=${a.type}`);
      }
      console.info(`[bridge-raw-dump] items=${JSON.stringify((allItems as any[]).map(i => ({ id: i.id, bank_id: i.bank_id, status: i.status, status_message: i.status_code_description })))}`);

      // Sync bridge accounts to database (with bank names and status)
      const syncedAccounts = await syncBridgeAccounts(
        supabaseAdmin,
        bridgeClient,
        company_id,
        bridge_user_uuid,
        allAccounts,
        allItems
      );

      // Auto-assign accounts if user has only one company and no assignments exist yet
      const { data: userCompanies } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (userCompanies && userCompanies.length === 1) {
        const singleCompanyId = userCompanies[0].id;
        const bridgeAccountIds = allAccounts.map((a: BridgeAccount) => a.id);

        // Auto-assign one-shot: ne touche JAMAIS un compte qui a déjà une décision
        // (active OU excluded). Ignore aussi les comptes non-actifs côté Bridge
        // (lifecycle_status ∈ disabled|deleted|replaced).
        const { data: nonActiveRows } = await supabaseAdmin
          .from('bridge_accounts')
          .select('bridge_account_id')
          .in('bridge_account_id', bridgeAccountIds)
          .neq('lifecycle_status', 'active');
        const nonActiveSet = new Set((nonActiveRows || []).map((r: any) => r.bridge_account_id));

        const { data: existingAssignments } = await supabaseAdmin
          .from('company_bridge_accounts')
          .select('bridge_account_id')
          .in('bridge_account_id', bridgeAccountIds);

        const alreadyDecided = new Set((existingAssignments || []).map((a: any) => a.bridge_account_id));
        const { data: identityExclusions } = await supabaseAdmin
          .from('company_bridge_account_identity_exclusions')
          .select('account_identity')
          .eq('company_id', singleCompanyId);
        const blockedIdentities = new Set((identityExclusions || []).map((e: any) => e.account_identity));
        const accountIdentityById = new Map(
          allAccounts.map((a: BridgeAccount) => [
            a.id,
            publicComputeAccountIdentity(a.iban, a.name, (a as any).account_type || a.type || null),
          ]),
        );
        const toAutoAssign = bridgeAccountIds.filter(
          (id: number) => !alreadyDecided.has(id) && !nonActiveSet.has(id) && !blockedIdentities.has(accountIdentityById.get(id))
        );

        if (toAutoAssign.length > 0) {
          console.info(`[bridge-sync] Auto-assigning ${toAutoAssign.length} accounts to single company ${singleCompanyId}`);
          const { error: autoAssignError } = await supabaseAdmin
            .from('company_bridge_accounts')
            .insert(toAutoAssign.map((bridge_account_id: number) => ({
              company_id: singleCompanyId,
              bridge_account_id,
            })));
          if (autoAssignError) {
            console.error('[bridge-sync] Auto-assign error:', autoAssignError);
          }
        }
      }

      // Recompute company stats from the single source of truth
      // (company_bridge_accounts). Triggers already maintain consistency on
      // assignment changes, but we trigger explicitly here to refresh
      // bank_balance_updated_at after a manual sync.
      await recomputeCompanyStats(supabaseAdmin, company_id);

      const { data: refreshedCompany } = await supabaseAdmin
        .from('companies')
        .select('bank_balance, bridge_accounts_count')
        .eq('id', company_id)
        .single();

      const assignedCount = refreshedCompany?.bridge_accounts_count ?? 0;
      const assignedBalance = Number(refreshedCompany?.bank_balance ?? 0);

      console.info(`[bridge-sync] Assigned accounts: ${assignedCount}, balance: ${assignedBalance.toLocaleString('fr-FR')}€`);

      if (action === 'sync-accounts') {
        return successResponse({
          accounts: allAccounts.length,
          syncedAccounts,
          assignedCount,
          totalBalance: assignedBalance,
        });
      }

      // ============================================
      // Heavy transaction sync: run in background via waitUntil
      // Return account data immediately to avoid CPU timeout
      // ============================================
      const backgroundSync = async () => {
        try {
          // Cutoff: never go further back than (company.created_at - 1 month buffer).
          // For full-sync we want to honor since_days fully — the cutoff only serves
          // to avoid pulling pre-company-creation data on very old Bridge connections.
          const { data: companyForCutoff } = await supabaseAdmin
            .from('companies')
            .select('created_at')
            .eq('id', company_id)
            .single();
          
          let cutoffDateStr: string | undefined;
          if (companyForCutoff?.created_at) {
            const cutoff = new Date(companyForCutoff.created_at);
            cutoff.setMonth(cutoff.getMonth() - 1);
            cutoffDateStr = cutoff.toISOString().split('T')[0];
            console.info(`[bridge-sync] Full-sync cutoff date: ${cutoffDateStr} (company created: ${companyForCutoff.created_at}, since_days: ${since_days ?? 365})`);
          }

          const allTxs = await bridgeClient.fetchAllTransactions(since_days ?? 365, cutoffDateStr);

          // Build account→company map for proper transaction assignment
          const acctToCompanyMap = await getAccountToCompanyMap(supabaseAdmin, bridge_user_uuid!);

          // Sync transactions with correct company assignments. user_id is
          // resolved per target company inside syncCompanyTransactions; we
          // pass the triggering user as a safety fallback only.
          const { inserted, updated } = await syncCompanyTransactions(
            supabaseAdmin,
            bridgeClient,
            userId,
            allAccounts,
            allTxs,
            acctToCompanyMap
          );

          console.info(`[bridge-sync] Background sync complete: ${inserted} new, ${updated} updated transactions`);

          // Auto-apply automation rules for impacted companies (full-sync path)
          if (inserted > 0 || updated > 0) {
            const impactedCompanyIds = Array.from(
              new Set(
                Object.values(acctToCompanyMap).filter((id): id is string => !!id)
              )
            );
            for (const cid of impactedCompanyIds) {
              try {
                const applyRes = await fetch(
                  `${supabaseUrl}/functions/v1/apply-all-automation-rules`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({ company_id: cid }),
                  }
                );
                const applyData = await applyRes.json();
                console.info(
                  `[bridge-sync] Auto-categorized ${applyData.updated || 0} transactions for company ${cid}`
                );
              } catch (autoErr) {
                console.error(
                  `[bridge-sync] Failed to apply automation rules for company ${cid}:`,
                  autoErr
                );
              }
            }
          }

          // ============================================
          // Point Zéro: Create initial snapshot if none exists
          // ============================================
          const { data: existingSnapshots } = await supabaseAdmin
            .from('bank_balance_snapshots')
            .select('id')
            .eq('company_id', company_id)
            .limit(1);

          if (!existingSnapshots || existingSnapshots.length === 0) {
            console.info(`[bridge-sync] No snapshots found for company ${company_id}, creating Point Zéro...`);
            
            const { data: companyAssignments } = await supabaseAdmin
              .from('company_bridge_accounts')
              .select('bridge_account_id')
              .eq('company_id', company_id)
              .eq('status', 'active');
            
            const assignedAccountIds = (companyAssignments || []).map((a: any) => a.bridge_account_id);
            
            if (assignedAccountIds.length > 0) {
              const now = new Date();
              const firstOfMonth = `${now.toISOString().substring(0, 7)}-01`;
              const todayStr = now.toISOString().split('T')[0];
              
              const { data: monthTxs } = await supabaseAdmin
                .from('transactions')
                .select('amount, type')
                .eq('company_id', company_id)
                .gte('date', firstOfMonth)
                .lte('date', todayStr)
                .is('deleted_at', null)
                .or('is_ignored.is.null,is_ignored.eq.false');
              
              const netThisMonth = (monthTxs || []).reduce((sum: number, tx: any) => {
                const amt = Number(tx.amount);
                return sum + (tx.type === 'income' ? amt : -amt);
              }, 0);
              
              const pointZeroBalance = Math.round((assignedBalance - netThisMonth) * 100) / 100;
              const primaryAccountId = assignedAccountIds[0];
              
              const { error: snapError } = await supabaseAdmin
                .from('bank_balance_snapshots')
                .upsert({
                  company_id: company_id,
                  bridge_account_id: primaryAccountId,
                  balance: pointZeroBalance,
                  snapshot_date: firstOfMonth,
                }, { onConflict: 'bridge_account_id,snapshot_date' });
              
              if (snapError) {
                console.error(`[bridge-sync] Failed to create Point Zéro snapshot:`, snapError);
              } else {
                console.info(`[bridge-sync] Point Zéro created: ${pointZeroBalance}€ at ${firstOfMonth}`);
              }
            }
          }

          // Apply automation rules after full-sync if new transactions were inserted
          if (inserted > 0) {
            try {
              console.info(`[bridge-sync] Applying automation rules after full-sync for company ${company_id}...`);
              const applyRes = await fetch(
                `${supabaseUrl}/functions/v1/apply-all-automation-rules`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({ company_id }),
                }
              );
              const applyData = await applyRes.json();
              console.info(`[bridge-sync] Auto-categorized ${applyData.updated || 0} transactions`);
            } catch (autoErr) {
              console.error(`[bridge-sync] Failed to apply automation rules:`, autoErr);
            }
          }
        } catch (bgErr) {
          console.error(`[bridge-sync] Background sync error:`, bgErr);
        }
      };

      // Start background processing - response returns immediately
      (globalThis as any).EdgeRuntime?.waitUntil?.(backgroundSync()) 
        ?? backgroundSync(); // Fallback: run inline if waitUntil not available

      return successResponse({ 
        accounts: allAccounts.length,
        syncedAccounts,
        assignedCount,
        totalBalance: assignedBalance,
        backgroundSync: true,
      });
    }

    return errorResponse(`Action non reconnue: ${action}`);

  } catch (error) {
    console.error('[bridge-sync] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return errorResponse(`Erreur Bridge: ${errorMessage}`, 500);
  }
});
