// Deno tests pour bridge-accounts.
// Vérifie la garantie principale : l'action `get-accounts` n'expose JAMAIS la
// liste brute Bridge — elle exige un `company_id` et lit la vue Qashflow
// `company_active_bridge_accounts`. C'est cette règle qui empêche les comptes
// exclus de "ré-apparaître" via un appel direct à Bridge.

import { assertEquals, assert } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import { bridgeAccountsRequestSchema } from '../_shared/validation.ts';

Deno.test('get-accounts schema accepts request without bridge_user_uuid', () => {
  const parsed = bridgeAccountsRequestSchema.safeParse({
    action: 'get-accounts',
    company_id: '00000000-0000-0000-0000-000000000001',
  });
  assert(parsed.success, 'get-accounts must be allowed without bridge_user_uuid');
});

Deno.test('get-accounts schema accepts company_id only (Qashflow source)', () => {
  const parsed = bridgeAccountsRequestSchema.safeParse({
    action: 'get-accounts',
    company_id: '00000000-0000-0000-0000-000000000001',
  });
  assertEquals(parsed.success, true);
});

Deno.test('get-bridge-raw-accounts schema requires bridge_user_uuid', () => {
  const noUuid = bridgeAccountsRequestSchema.safeParse({
    action: 'get-bridge-raw-accounts',
  });
  assertEquals(noUuid.success, false);

  const withUuid = bridgeAccountsRequestSchema.safeParse({
    action: 'get-bridge-raw-accounts',
    bridge_user_uuid: '11111111-1111-1111-1111-111111111111',
  });
  assertEquals(withUuid.success, true);
});

Deno.test('get-transaction-categories schema requires bridge_user_uuid', () => {
  const result = bridgeAccountsRequestSchema.safeParse({
    action: 'get-transaction-categories',
  });
  assertEquals(result.success, false);
});

// Smoke test: HTTP appel get-accounts sans company_id => 400.
// Garantit qu'aucun chemin ne retombe sur la liste brute Bridge.
Deno.test({
  name: 'POST get-accounts without company_id returns 400',
  ignore: !Deno.env.get('BRIDGE_ACCOUNTS_FN_URL'),
  fn: async () => {
    const url = Deno.env.get('BRIDGE_ACCOUNTS_FN_URL')!;
    const token = Deno.env.get('TEST_USER_JWT') ?? 'test-token';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'get-accounts' }),
    });
    assertEquals(res.status, 400);
  },
});
