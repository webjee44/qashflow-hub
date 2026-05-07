import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeMerchantKey,
  normalizeDescription,
  deriveTransactionNormalization,
} from "../merchantNormalizer.ts";

Deno.test("merchant_key is stable across bank prefixes and dates", () => {
  // 2-letter tokens like "EU" are stripped (conservative noise filter).
  const a = computeMerchantKey("CARTE 12/05 AMAZON EU LUX");
  const b = computeMerchantKey("PAIEMENT CB AMAZON EU LUX 25-05-2024");
  const c = computeMerchantKey("AMAZON EU LUX REF 9182734");
  assertEquals(a, "AMAZON LUX");
  assertEquals(b, "AMAZON LUX");
  assertEquals(c, "AMAZON LUX");
});

Deno.test("merchant_key strips SEPA prefix and trailing refs", () => {
  const a = computeMerchantKey("PRLV SEPA URSSAF IDF REF 12345678");
  const b = computeMerchantKey("PRELEVEMENT URSSAF IDF");
  assertEquals(a, "URSSAF IDF");
  assertEquals(b, "URSSAF IDF");
});

Deno.test("merchant_key returns null for purely generic descriptions", () => {
  assertEquals(computeMerchantKey("CARTE 12/05 EUR"), null);
  assertEquals(computeMerchantKey(""), null);
  assertEquals(computeMerchantKey("123 456"), null);
});

Deno.test("normalizeDescription preserves token order", () => {
  assertEquals(normalizeDescription("CARTE 12/05 AMAZON EU LUX"), "AMAZON EU LUX");
  assertEquals(normalizeDescription("Virement SALAIRE Mai"), "SALAIRE MAI");
});

Deno.test("merchant_key truncates very long descriptions to 4 tokens", () => {
  const key = computeMerchantKey("PAIEMENT CB STARBUCKS COFFEE PARIS GARE LYON TERMINAL 0042");
  assertEquals(key, "STARBUCKS COFFEE PARIS GARE");
});

Deno.test("deriveTransactionNormalization handles null input", () => {
  const result = deriveTransactionNormalization(null);
  assertEquals(result, { merchant_key: null, normalized_description: null });
});

Deno.test("merchant_key is case and accent insensitive", () => {
  const a = computeMerchantKey("Café Müller Élysée");
  const b = computeMerchantKey("CAFE MULLER ELYSEE");
  assertEquals(a, b);
});
