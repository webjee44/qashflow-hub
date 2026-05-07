/**
 * PR5 — Frontend mirror of `supabase/functions/_shared/merchantNormalizer.ts`.
 *
 * MUST stay in sync with the edge counterpart. Both files share the exact
 * same algorithm so the merchant_key shown in the UI (preview, suggestions,
 * rule editor) matches what the runner persists on transactions.
 *
 * If you change this file, change the edge file too — and rerun:
 *  - vitest src/lib/merchantNormalizer.test.ts
 *  - deno test supabase/functions/_shared/tests/merchantNormalizer.test.ts
 */

const BANK_PREFIX_TOKENS = new Set([
  'CARTE', 'CB', 'PAIEMENT', 'PAYMENT', 'ACHAT',
  'VIR', 'VIREMENT', 'VIRT', 'VRT',
  'PRLV', 'PRELEVEMENT', 'PRELEVT', 'SEPA',
  'CHQ', 'CHEQUE',
  'RETRAIT', 'DAB', 'GAB',
  'COMMISSION', 'FRAIS', 'COTISATION',
  'REMISE', 'ECHEANCE', 'ECHEAN',
  'INST', 'INSTANTANE', 'INSTANT',
  'INTERNET', 'WEB', 'EN LIGNE',
  'POUR', 'DE', 'DU', 'DE LA', 'AU',
  'REF', 'REFERENCE', 'NUM',
  'FACTURE', 'FACT', 'COMMANDE',
]);

const GENERIC_NOISE_TOKENS = new Set([
  'EUR', 'USD', 'GBP',
  'FR', 'FRA', 'FRANCE',
  'NA', 'SAS', 'SARL', 'SA', 'EURL', 'SASU',
]);

const DATE_LIKE_REGEX = /^\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?$/;
const PURE_DIGITS_REGEX = /^\d+$/;
const REF_LIKE_REGEX = /^(REF|NUM|N|NO|ID)[\-:]?\d+$/i;

const MIN_TOKEN_LENGTH = 3;
const MIN_KEY_LENGTH = 4;
const MAX_KEY_TOKENS = 4;

export function canonicalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s\/\-\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCoreTokens(canonical: string): string[] {
  const raw = canonical.split(' ').filter(Boolean);
  const core: string[] = [];
  for (const token of raw) {
    if (DATE_LIKE_REGEX.test(token)) continue;
    if (PURE_DIGITS_REGEX.test(token)) continue;
    if (REF_LIKE_REGEX.test(token)) continue;
    if (token.length < MIN_TOKEN_LENGTH) continue;
    if (BANK_PREFIX_TOKENS.has(token)) continue;
    if (GENERIC_NOISE_TOKENS.has(token)) continue;
    core.push(token);
  }
  return core;
}

export function normalizeDescription(rawDescription: string): string | null {
  if (!rawDescription || typeof rawDescription !== 'string') return null;
  const canonical = canonicalize(rawDescription);
  if (!canonical) return null;
  const core = extractCoreTokens(canonical);
  if (core.length === 0) return null;
  return core.join(' ');
}

export function computeMerchantKey(rawDescription: string): string | null {
  const normalized = normalizeDescription(rawDescription);
  if (!normalized) return null;
  const tokens = normalized.split(' ').slice(0, MAX_KEY_TOKENS);
  const key = tokens.join(' ');
  if (key.length < MIN_KEY_LENGTH) return null;
  return key;
}

export interface NormalizedTransactionFields {
  merchant_key: string | null;
  normalized_description: string | null;
}

export function deriveTransactionNormalization(
  rawDescription: string | null | undefined,
): NormalizedTransactionFields {
  if (!rawDescription) {
    return { merchant_key: null, normalized_description: null };
  }
  return {
    merchant_key: computeMerchantKey(rawDescription),
    normalized_description: normalizeDescription(rawDescription),
  };
}
