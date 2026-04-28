import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { BridgeClient, type BridgeTransaction } from '../bridge-client.ts';

const baseTransaction: BridgeTransaction = {
  id: 1,
  clean_description: 'Remise CB',
  bank_description: 'REMISE CB 5091540010 - NB0036/117290',
  provider_description: 'REMISE CB 5091540010 - NB0036/117290',
  amount: 812.27,
  date: '2026-04-27',
  updated_at: '2026-04-27T00:00:00.000Z',
  currency_code: 'EUR',
  is_deleted: false,
  category_id: null,
  account_id: 61698457,
  is_future: false,
};

Deno.test('BridgeClient.getTransactionDescription keeps provider_description before normalized clean_description', () => {
  const client = new BridgeClient();

  assertEquals(
    client.getTransactionDescription(baseTransaction),
    'REMISE CB 5091540010 - NB0036/117290',
  );
});

Deno.test('BridgeClient.getTransactionDescription falls back to clean_description only when complete labels are absent', () => {
  const client = new BridgeClient();
  const transactionWithoutCompleteLabels: BridgeTransaction = {
    ...baseTransaction,
    provider_description: undefined,
    raw_description: undefined,
    bank_description: '',
    description: undefined,
  };

  assertEquals(
    client.getTransactionDescription(transactionWithoutCompleteLabels),
    'Remise CB',
  );
});

Deno.test('BridgeClient.refreshItem returns ok=true on 202 Accepted', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  let calledMethod = '';
  globalThis.fetch = (input: any, init?: any) => {
    calledUrl = typeof input === 'string' ? input : input.url;
    calledMethod = init?.method ?? 'GET';
    return Promise.resolve(new Response('', { status: 202 }));
  };
  try {
    const client = new BridgeClient();
    client.setAccessToken('fake-token');
    const result = await client.refreshItem(12345);
    assertEquals(result.ok, true);
    assertEquals(result.status, 202);
    assertEquals(calledMethod, 'POST');
    assertEquals(
      calledUrl,
      'https://api.bridgeapi.io/v3/aggregation/items/12345/refresh',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('BridgeClient.refreshItem returns ok=false on 429 rate limit', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response('rate limited', { status: 429 }));
  try {
    const client = new BridgeClient();
    client.setAccessToken('fake-token');
    const result = await client.refreshItem(99);
    assertEquals(result.ok, false);
    assertEquals(result.status, 429);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
