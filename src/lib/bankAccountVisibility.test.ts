import { describe, expect, it } from 'vitest';
import { selectPendingBridgeAccounts, type BridgeAccountVisibilityRow } from './bankAccountVisibility';

const base = (overrides: Partial<BridgeAccountVisibilityRow>): BridgeAccountVisibilityRow => ({
  bridge_account_id: 1,
  bridge_item_id: 10,
  bridge_user_uuid: 'bridge-user-1',
  account_identity: 'fr761234',
  iban: 'FR761234',
  name: 'Compte courant',
  lifecycle_status: 'active',
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
  ...overrides,
});

describe('selectPendingBridgeAccounts', () => {
  it('keeps active accounts with no assignment decision', () => {
    const rows = [base({ bridge_account_id: 101 })];

    expect(selectPendingBridgeAccounts(rows, { decidedBridgeAccountIds: [] }).map(a => a.bridge_account_id))
      .toEqual([101]);
  });

  it('excludes already active or excluded assignments from pending accounts', () => {
    const rows = [base({ bridge_account_id: 101 }), base({ bridge_account_id: 102, account_identity: 'fr769999' })];

    expect(selectPendingBridgeAccounts(rows, { decidedBridgeAccountIds: [101] }).map(a => a.bridge_account_id))
      .toEqual([102]);
  });

  it('deduplicates reconnect duplicates by account identity and keeps the newest account id', () => {
    const rows = [
      base({ bridge_account_id: 101, created_at: '2026-06-02T10:59:21Z' }),
      base({ bridge_account_id: 201, created_at: '2026-06-02T11:00:58Z' }),
    ];

    expect(selectPendingBridgeAccounts(rows, { decidedBridgeAccountIds: [] }).map(a => a.bridge_account_id))
      .toEqual([201]);
  });

  it('respects durable blocks by bridge account id and account identity', () => {
    const rows = [
      base({ bridge_account_id: 101, account_identity: 'fr761111' }),
      base({ bridge_account_id: 102, account_identity: 'fr762222' }),
      base({ bridge_account_id: 103, account_identity: 'fr763333' }),
    ];

    expect(selectPendingBridgeAccounts(rows, {
      decidedBridgeAccountIds: [],
      blockedBridgeAccountIds: [101],
      blockedAccountIdentities: ['FR762222'],
    }).map(a => a.bridge_account_id)).toEqual([103]);
  });

  it('drops non-active lifecycle rows', () => {
    const rows = [base({ bridge_account_id: 101, lifecycle_status: 'replaced' })];

    expect(selectPendingBridgeAccounts(rows, { decidedBridgeAccountIds: [] })).toEqual([]);
  });
});