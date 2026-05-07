import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { computeSpecificityScore, isConflictingScore } from '../ruleScoring.ts';

Deno.test('merchant_key dominates description', () => {
  const score = computeSpecificityScore([
    { condition_field: 'merchant_key', condition_operator: 'equals', condition_value: 'urssaf' },
  ]);
  assertEquals(score, 50);
});

Deno.test('description >=4 chars adds small bonus', () => {
  const s = computeSpecificityScore([
    { condition_field: 'description', condition_operator: 'contains', condition_value: 'AMAZON' },
  ]);
  assertEquals(s, 2);
});

Deno.test('description <4 chars penalised', () => {
  const s = computeSpecificityScore([
    { condition_field: 'description', condition_operator: 'contains', condition_value: 'GD' },
  ]);
  assertEquals(s, -20);
});

Deno.test('combined conditions sum', () => {
  const s = computeSpecificityScore([
    { condition_field: 'description', condition_operator: 'contains', condition_value: 'AMAZON' },
    { condition_field: 'amount', condition_operator: 'equals', condition_value: '99.99' },
    { condition_field: 'bank_account_name', condition_operator: 'equals', condition_value: 'Compte Pro' },
  ]);
  assertEquals(s, 2 + 15 + 20);
});

Deno.test('conflict threshold', () => {
  assert(isConflictingScore(50, 52));
  assert(!isConflictingScore(50, 60));
});
