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
