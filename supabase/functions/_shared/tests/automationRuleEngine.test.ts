/**
 * PR1 tests — single source of truth for automation matching.
 * Validates: VAPOSTORE happy path + idempotence, conflict resolution,
 * tenant security boundaries.
 *
 * The shared engine is exercised through an in-memory Supabase mock so the
 * tests run hermetically (no Deno --allow-net, no real DB).
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  applyAutomationRulesForCompany,
  TenantSecurityError,
} from '../automationRuleEngine.ts';

// ---------------------------------------------------------------------------
// Tiny in-memory Supabase mock — only the surface the engine actually uses.
// ---------------------------------------------------------------------------

type Row = Record<string, any>;
interface Store {
  companies: Row[];
  company_members: Row[];
  automation_rules: Row[];
  automation_rule_conditions: Row[];
  categories: Row[];
  transactions: Row[];
  automation_runs: Row[];
  automation_run_items: Row[];
}

function makeStore(partial: Partial<Store> = {}): Store {
  return {
    companies: [],
    company_members: [],
    automation_rules: [],
    automation_rule_conditions: [],
    categories: [],
    transactions: [],
    automation_runs: [],
    automation_run_items: [],
    ...partial,
  };
}

interface Filter {
  kind: 'eq' | 'in' | 'is' | 'not_is_null' | 'range';
  column?: string;
  value?: any;
  values?: any[];
  from?: number;
  to?: number;
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  let out = rows;
  for (const f of filters) {
    if (f.kind === 'eq') out = out.filter((r) => r[f.column!] === f.value);
    else if (f.kind === 'in') out = out.filter((r) => (f.values || []).includes(r[f.column!]));
    else if (f.kind === 'is') out = out.filter((r) => (r[f.column!] ?? null) === f.value);
    else if (f.kind === 'not_is_null') out = out.filter((r) => r[f.column!] !== null && r[f.column!] !== undefined);
    else if (f.kind === 'range') out = out.slice(f.from!, f.to! + 1);
  }
  return out;
}

function makeBuilder(store: Store, table: keyof Store, op: 'select' | 'update' | 'insert' | 'delete', payload?: any) {
  const filters: Filter[] = [];
  const builder: any = {};

  // Chainable filter methods.
  builder.eq = (column: string, value: any) => {
    filters.push({ kind: 'eq', column, value });
    return builder;
  };
  builder.in = (column: string, values: any[]) => {
    filters.push({ kind: 'in', column, values });
    return builder;
  };
  builder.is = (column: string, value: any) => {
    filters.push({ kind: 'is', column, value });
    return builder;
  };
  builder.not = (column: string, _operator: string, _value: any) => {
    // engine uses .not('xxx', 'is', null) and .not('company_id', 'is', null)
    filters.push({ kind: 'not_is_null', column });
    return builder;
  };
  builder.range = (from: number, to: number) => {
    filters.push({ kind: 'range', from, to });
    return builder;
  };
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.select = (_cols?: string) => builder; // for insert(...).select()

  // Terminal helpers.
  builder.maybeSingle = async () => {
    const rows = applyFilters(store[table], filters);
    return { data: rows[0] ?? null, error: null };
  };
  builder.single = async () => {
    const rows = applyFilters(store[table], filters);
    if (rows.length === 0) return { data: null, error: { message: 'no rows' } };
    return { data: rows[0], error: null };
  };
  // Awaiting the builder directly (e.g. select queries) runs the query.
  builder.then = (resolve: any, reject: any) => {
    try {
      if (op === 'select') {
        const rows = applyFilters(store[table], filters);
        resolve({ data: rows, error: null });
      } else if (op === 'update') {
        const rows = applyFilters(store[table], filters);
        for (const r of rows) Object.assign(r, payload);
        resolve({ data: rows, error: null });
      } else if (op === 'insert') {
        const items = Array.isArray(payload) ? payload : [payload];
        const inserted = items.map((item) => ({ id: cryptoRandomId(), ...item }));
        store[table].push(...inserted);
        resolve({ data: inserted, error: null });
      } else {
        resolve({ data: null, error: null });
      }
    } catch (err) {
      reject(err);
    }
  };
  return builder;
}

function cryptoRandomId() {
  return crypto.randomUUID();
}

function makeClient(store: Store) {
  return {
    store,
    from(table: keyof Store) {
      return {
        select: (_cols?: string) => makeBuilder(store, table, 'select'),
        update: (payload: any) => makeBuilder(store, table, 'update', payload),
        insert: (payload: any) => {
          const b = makeBuilder(store, table, 'insert', payload);
          // insert(...).select(...).single() path used by createRun.
          b.select = (_c?: string) => {
            const items = Array.isArray(payload) ? payload : [payload];
            const inserted = items.map((item) => ({ id: cryptoRandomId(), ...item }));
            store[table].push(...inserted);
            return {
              single: async () => ({ data: inserted[0], error: null }),
              maybeSingle: async () => ({ data: inserted[0], error: null }),
            };
          };
          return b;
        },
        delete: () => makeBuilder(store, table, 'delete'),
      };
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const C1 = '11111111-1111-1111-1111-111111111111';
const C2 = '22222222-2222-2222-2222-222222222222';
const USER1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CAT_VENTES = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const CAT_OTHER = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function buildBaseStore(): Store {
  return makeStore({
    companies: [
      { id: C1, user_id: USER1, deleted_at: null },
      { id: C2, user_id: USER2, deleted_at: null },
    ],
    categories: [
      { id: CAT_VENTES, type: 'income' },
      { id: CAT_OTHER, type: 'income' },
    ],
  });
}

// ---------------------------------------------------------------------------
// Test 1 — VAPOSTORE happy path + idempotence
// ---------------------------------------------------------------------------

Deno.test('VAPOSTORE rule applies and is idempotent', async () => {
  const store = buildBaseStore();
  const ruleId = cryptoRandomId();
  store.automation_rules.push({
    id: ruleId,
    name: 'VAPOSTORE → Ventes',
    company_id: C1,
    user_id: USER1,
    is_active: true,
    priority: 100,
    specificity_score: 50,
    created_at: '2026-01-01T00:00:00Z',
    target_category_id: CAT_VENTES,
    condition_field: 'description',
    condition_operator: 'contains',
    condition_value: 'VAPOSTORE',
    match_count: 0,
  });
  const txId = cryptoRandomId();
  store.transactions.push({
    id: txId,
    company_id: C1,
    user_id: USER1,
    description: 'VIR VAPOSTORE Vapostore Cloudvapor 202601380',
    amount: 10089.12,
    type: 'income',
    category_id: null,
    bank_account_name: null,
    merchant_key: null,
    normalized_description: null,
    deleted_at: null,
  });

  const client = makeClient(store);

  const result = await applyAutomationRulesForCompany({
    client,
    companyId: C1,
    userId: USER1,
    triggeredBy: 'manual',
    dryRun: false,
  });

  assertEquals(result.applied, 1, 'should apply exactly 1 transaction');
  assertEquals(result.matched, 1);
  assertEquals(result.skippedConflict, 0);
  const decision = result.decisions.find((d) => d.transaction_id === txId);
  assertEquals(decision?.decision, 'applied');
  assertEquals(decision?.winning_rule_id, ruleId);
  assertEquals(decision?.target_category_id, CAT_VENTES);

  // Transaction is persisted.
  assertEquals(store.transactions[0].category_id, CAT_VENTES);
  // Run & items written.
  assertEquals(store.automation_runs.length, 1);
  assertEquals(store.automation_run_items.length, 1);
  // Match count incremented.
  assertEquals(store.automation_rules[0].match_count, 1);

  // Second run → idempotent.
  const second = await applyAutomationRulesForCompany({
    client,
    companyId: C1,
    userId: USER1,
    triggeredBy: 'manual',
    dryRun: false,
  });
  assertEquals(second.applied, 0, 'second pass must not re-apply');
  assertEquals(second.matched, 0);
});

// ---------------------------------------------------------------------------
// Test 2 — Conflict between two rules of close specificity
// ---------------------------------------------------------------------------

Deno.test('conflict between two close-specificity rules is detected, no write', async () => {
  const store = buildBaseStore();
  const ruleA = cryptoRandomId();
  const ruleB = cryptoRandomId();
  store.automation_rules.push(
    {
      id: ruleA,
      name: 'A',
      company_id: C1,
      user_id: USER1,
      is_active: true,
      priority: 100,
      specificity_score: 50,
      created_at: '2026-01-01T00:00:00Z',
      target_category_id: CAT_VENTES,
      condition_field: 'description',
      condition_operator: 'contains',
      condition_value: 'OVERLAP',
      match_count: 0,
    },
    {
      id: ruleB,
      name: 'B',
      company_id: C1,
      user_id: USER1,
      is_active: true,
      priority: 100,
      specificity_score: 51, // close score → triggers conflict
      created_at: '2026-01-02T00:00:00Z',
      target_category_id: CAT_OTHER,
      condition_field: 'description',
      condition_operator: 'contains',
      condition_value: 'OVERLAP',
      match_count: 0,
    },
  );
  const txId = cryptoRandomId();
  store.transactions.push({
    id: txId,
    company_id: C1,
    user_id: USER1,
    description: 'OVERLAP test',
    amount: 100,
    type: 'income',
    category_id: null,
    bank_account_name: null,
    merchant_key: null,
    normalized_description: null,
    deleted_at: null,
  });

  const client = makeClient(store);
  const result = await applyAutomationRulesForCompany({
    client,
    companyId: C1,
    userId: USER1,
    triggeredBy: 'manual',
    dryRun: false,
  });

  assertEquals(result.applied, 0);
  assertEquals(result.skippedConflict, 1);
  const decision = result.decisions[0];
  assertEquals(decision.decision, 'conflict');
  assertEquals(decision.competing_rules?.length, 2);
  // No write.
  assertEquals(store.transactions[0].category_id, null);
});

// ---------------------------------------------------------------------------
// Test 3 — Tenant security boundaries
// ---------------------------------------------------------------------------

Deno.test('tenant security: rule belonging to another company is refused', async () => {
  const store = buildBaseStore();
  const ruleId = cryptoRandomId();
  // Rule belongs to C2 but caller passes companyId = C1.
  store.automation_rules.push({
    id: ruleId,
    name: 'X',
    company_id: C2,
    user_id: USER2,
    is_active: true,
    priority: 100,
    specificity_score: 10,
    created_at: '2026-01-01T00:00:00Z',
    target_category_id: CAT_VENTES,
    condition_field: 'description',
    condition_operator: 'contains',
    condition_value: 'X',
    match_count: 0,
  });

  const client = makeClient(store);
  await assertRejects(
    () =>
      applyAutomationRulesForCompany({
        client,
        companyId: C1,
        userId: USER1,
        triggeredBy: 'manual',
        ruleId,
        dryRun: false,
      }),
    TenantSecurityError,
  );
});

Deno.test('tenant security: user without access to companyId is refused', async () => {
  const store = buildBaseStore();
  // USER2 has no membership of C1.
  const client = makeClient(store);
  await assertRejects(
    () =>
      applyAutomationRulesForCompany({
        client,
        companyId: C1,
        userId: USER2,
        triggeredBy: 'manual',
        dryRun: false,
      }),
    TenantSecurityError,
  );
});

Deno.test('tenant security: transactionIds from another company are refused', async () => {
  const store = buildBaseStore();
  const otherTx = cryptoRandomId();
  store.transactions.push({
    id: otherTx,
    company_id: C2,
    user_id: USER2,
    description: 'x',
    amount: 1,
    type: 'income',
    category_id: null,
    bank_account_name: null,
    merchant_key: null,
    normalized_description: null,
    deleted_at: null,
  });
  const client = makeClient(store);
  await assertRejects(
    () =>
      applyAutomationRulesForCompany({
        client,
        companyId: C1,
        userId: USER1,
        triggeredBy: 'manual',
        transactionIds: [otherTx],
        dryRun: false,
      }),
    TenantSecurityError,
  );
});

Deno.test('tenant security: manual trigger without userId is refused', async () => {
  const store = buildBaseStore();
  const client = makeClient(store);
  await assertRejects(
    () =>
      applyAutomationRulesForCompany({
        client,
        companyId: C1,
        userId: null,
        triggeredBy: 'manual',
        dryRun: false,
      }),
    TenantSecurityError,
  );
});
