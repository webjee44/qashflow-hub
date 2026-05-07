import { describe, it, expect } from 'vitest';
import {
  computeMerchantKey,
  normalizeDescription,
  deriveTransactionNormalization,
} from './merchantNormalizer';

describe('merchantNormalizer (frontend mirror)', () => {
  it('produces the same key for the same merchant under different bank phrasings', () => {
    expect(computeMerchantKey('CARTE 12/05 AMAZON EU LUX')).toBe('AMAZON EU LUX');
    expect(computeMerchantKey('PAIEMENT CB AMAZON EU LUX 25-05-2024')).toBe('AMAZON EU LUX');
    expect(computeMerchantKey('AMAZON EU LUX REF 9182734')).toBe('AMAZON EU LUX');
  });

  it('strips SEPA prefix and refs', () => {
    expect(computeMerchantKey('PRLV SEPA URSSAF IDF REF 12345678')).toBe('URSSAF IDF');
  });

  it('returns null for descriptions without merchant signal', () => {
    expect(computeMerchantKey('CARTE 12/05 EUR')).toBeNull();
    expect(computeMerchantKey('')).toBeNull();
    expect(computeMerchantKey('123 456')).toBeNull();
  });

  it('truncates long descriptions to 4 tokens', () => {
    expect(computeMerchantKey('PAIEMENT CB STARBUCKS COFFEE PARIS GARE LYON TERMINAL 0042'))
      .toBe('STARBUCKS COFFEE PARIS GARE');
  });

  it('is case and accent insensitive', () => {
    expect(computeMerchantKey('Café Müller Élysée')).toBe(computeMerchantKey('CAFE MULLER ELYSEE'));
  });

  it('deriveTransactionNormalization handles null', () => {
    expect(deriveTransactionNormalization(null)).toEqual({
      merchant_key: null,
      normalized_description: null,
    });
  });

  it('normalizeDescription preserves token order', () => {
    expect(normalizeDescription('Virement SALAIRE Mai')).toBe('SALAIRE MAI');
  });
});
