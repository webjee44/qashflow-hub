export interface BridgeAccountVisibilityRow {
  bridge_account_id: number;
  bridge_item_id?: number | null;
  bridge_user_uuid: string;
  account_identity?: string | null;
  iban?: string | null;
  name?: string | null;
  lifecycle_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PendingBridgeAccountOptions {
  decidedBridgeAccountIds: Iterable<number>;
  blockedBridgeAccountIds?: Iterable<number>;
  blockedAccountIdentities?: Iterable<string | null | undefined>;
}

const normalizeIdentity = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

const getStableAccountKey = (row: BridgeAccountVisibilityRow) => {
  const identity = normalizeIdentity(row.account_identity);
  if (identity) return `${row.bridge_user_uuid}:${identity}`;
  return `${row.bridge_user_uuid}:bridge:${row.bridge_account_id}`;
};

const isNewerAccountRow = (candidate: BridgeAccountVisibilityRow, current: BridgeAccountVisibilityRow) => {
  const candidateDate = new Date(candidate.created_at || candidate.updated_at || 0).getTime();
  const currentDate = new Date(current.created_at || current.updated_at || 0).getTime();

  if (candidateDate !== currentDate) return candidateDate > currentDate;
  return candidate.bridge_account_id > current.bridge_account_id;
};

export function selectPendingBridgeAccounts(
  rows: BridgeAccountVisibilityRow[],
  options: PendingBridgeAccountOptions,
) {
  const decidedIds = new Set(options.decidedBridgeAccountIds);
  const blockedIds = new Set(options.blockedBridgeAccountIds || []);
  const blockedIdentities = new Set(
    Array.from(options.blockedAccountIdentities || [])
      .map(normalizeIdentity)
      .filter(Boolean),
  );

  const byStableAccount = new Map<string, BridgeAccountVisibilityRow>();

  for (const row of rows) {
    if (row.lifecycle_status && row.lifecycle_status !== 'active') continue;
    if (decidedIds.has(row.bridge_account_id)) continue;
    if (blockedIds.has(row.bridge_account_id)) continue;

    const identity = normalizeIdentity(row.account_identity);
    if (identity && blockedIdentities.has(identity)) continue;

    const key = getStableAccountKey(row);
    const current = byStableAccount.get(key);
    if (!current || isNewerAccountRow(row, current)) {
      byStableAccount.set(key, row);
    }
  }

  return Array.from(byStableAccount.values()).sort((a, b) => {
    const aBank = a.name || a.iban || String(a.bridge_account_id);
    const bBank = b.name || b.iban || String(b.bridge_account_id);
    return aBank.localeCompare(bBank, 'fr');
  });
}