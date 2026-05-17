import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory mock state, mutated per test.
const mockState: {
  activeAccounts: Array<{ bridge_account_id: number | null }>;
  txPages: Array<Array<Record<string, unknown>>>;
} = {
  activeAccounts: [],
  txPages: [[]],
};

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from(table: string) {
        if (table === 'company_active_bridge_accounts') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: mockState.activeAccounts, error: null }),
            }),
          };
        }
        if (table === 'transactions') {
          // Chainable builder that captures range() to pick a page.
          const chain: Record<string, unknown> = {};
          const chainable = new Proxy(chain, {
            get(_t, prop) {
              if (prop === 'range') {
                return (from: number) => {
                  const page = mockState.txPages[Math.floor(from / 1000)] ?? [];
                  return Promise.resolve({ data: page, error: null });
                };
              }
              return () => chainable;
            },
          });
          return chainable;
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    },
  };
});

import { getTreasuryActuals } from '../api/treasuryActualsApi';

beforeEach(() => {
  mockState.activeAccounts = [];
  mockState.txPages = [[]];
});

describe('getTreasuryActuals', () => {
  it('drops bridge transactions on inactive accounts but keeps manual ones', async () => {
    mockState.activeAccounts = [{ bridge_account_id: 100 }];
    mockState.txPages = [[
      {
        id: 't-active', company_id: 'c1', date: '2026-04-01', type: 'income',
        amount: '500', description: 'ok', category_id: null, bridge_account_id: 100,
        categories: null,
      },
      {
        id: 't-inactive', company_id: 'c1', date: '2026-04-02', type: 'income',
        amount: '999', description: 'drop', category_id: null, bridge_account_id: 999,
        categories: null,
      },
      {
        id: 't-manual', company_id: 'c1', date: '2026-04-03', type: 'expense',
        amount: '42', description: 'manual', category_id: null, bridge_account_id: null,
        categories: null,
      },
    ]];

    const out = await getTreasuryActuals({
      companyId: 'c1', fromDate: '2026-04-01', toDate: '2026-04-30',
    });
    expect(out.map(r => r.id)).toEqual(['t-active', 't-manual']);
    expect(out[1].amount).toBe(42);
  });

  it('flags internal transfers via category name', async () => {
    mockState.activeAccounts = [];
    mockState.txPages = [[
      {
        id: 't1', company_id: 'c1', date: '2026-04-01', type: 'income',
        amount: '100', description: 'vir', category_id: 'cat-x',
        bridge_account_id: null,
        categories: { id: 'cat-x', name: 'Virement intercompte' },
      },
      {
        id: 't2', company_id: 'c1', date: '2026-04-02', type: 'income',
        amount: '100', description: 'sales', category_id: 'cat-y',
        bridge_account_id: null,
        categories: { id: 'cat-y', name: 'Ventes' },
      },
    ]];
    const out = await getTreasuryActuals({
      companyId: 'c1', fromDate: '2026-04-01', toDate: '2026-04-30',
    });
    expect(out.find(r => r.id === 't1')?.isInternalTransfer).toBe(true);
    expect(out.find(r => r.id === 't2')?.isInternalTransfer).toBe(false);
  });

  it('paginates beyond 1000 rows', async () => {
    mockState.activeAccounts = [];
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({
      id: `p1-${i}`, company_id: 'c1', date: '2026-04-01', type: 'income',
      amount: '1', description: '', category_id: null, bridge_account_id: null,
      categories: null,
    }));
    const partialPage = Array.from({ length: 3 }, (_, i) => ({
      id: `p2-${i}`, company_id: 'c1', date: '2026-04-02', type: 'income',
      amount: '1', description: '', category_id: null, bridge_account_id: null,
      categories: null,
    }));
    mockState.txPages = [fullPage, partialPage];
    const out = await getTreasuryActuals({
      companyId: 'c1', fromDate: '2026-04-01', toDate: '2026-04-30',
    });
    expect(out.length).toBe(1003);
  });
});
