/**
 * PR5 — Shared transaction normalizer.
 *
 * Goal: derive a stable `merchant_key` and a `normalized_description` from a
 * raw bank transaction description. Used by:
 *  - bridge-sync (on insert/update of every Bridge transaction)
 *  - backfill-merchant-keys (one-shot for historical data)
 *  - automation rule preview / matcher (to compare against rule.condition_value)
 *
 * Pure functions, zero IO, deterministic. Same logic must run in the frontend
 * (mirror at src/lib/merchantNormalizer.ts) so previews and saves stay aligned.
 *
 * Design notes:
 *  - We do NOT aim for a perfect merchant taxonomy. We aim for *stability*: the
 *    same merchant in two transactions of the same account must yield the same
 *    key, even if the bank pads dates, refs, or POS terminal IDs around it.
 *  - Bank prefixes (CARTE, PRLV SEPA, VIR, ...) and trailing dates/refs are
 *    stripped. The remaining "core" tokens form the merchant_key.
 *  - We keep this conservative: when in doubt, return null instead of a noisy
 *    key. Null `merchant_key` means "fall back to description matching".
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

// Generic single tokens that are never a merchant by themselves.
const GENERIC_NOISE_TOKENS = new Set([
  'EUR', 'USD', 'GBP',
  'FR', 'FRA', 'FRANCE',
  'NA', 'SAS', 'SARL', 'SA', 'EURL', 'SASU',
]);

// Date-like tokens we want to drop entirely from the core: 12/05, 12-05-2024,
// 20240512, 0512, etc. We strip them after canonicalisation.
const DATE_LIKE_REGEX = /^\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?$/;
const PURE_DIGITS_REGEX = /^\d+$/;
const REF_LIKE_REGEX = /^(REF|NUM|N|NO|ID)[\-:]?\d+$/i;

const MIN_TOKEN_LENGTH = 3;
const MIN_KEY_LENGTH = 4;
const MAX_KEY_TOKENS = 4;

/**
 * Canonicalise raw text: strip accents, uppercase, remove punctuation,
 * collapse whitespace. Same algorithm used by automationRuleMatchingCore.ts
 * for matching, so a description and its normalized form share the same
 * canonical space.
 */
export function canonicalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s\/\-\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip noise tokens (bank prefixes, dates, pure digits, refs) and return the
 * remaining tokens that likely identify the merchant.
 */
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

/**
 * Normalised, human-readable description used for grouping in UI and for
 * description-based matching. Strips noise but keeps token order.
 */
export function normalizeDescription(rawDescription: string): string | null {
  if (!rawDescription || typeof rawDescription !== 'string') return null;
  const canonical = canonicalize(rawDescription);
  if (!canonical) return null;
  const core = extractCoreTokens(canonical);
  if (core.length === 0) return null;
  return core.join(' ');
}

/**
 * Stable merchant key. Conservative: returns null when we can't get at least
 * MIN_KEY_LENGTH meaningful chars. Truncated to MAX_KEY_TOKENS tokens so a
 * merchant with a long suffix (POS terminal, store id) collapses to its head.
 */
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
