/**
 * Convert raw merchant_key (e.g. "CARREFOUR MARKET") into a friendly,
 * human-readable label ("Carrefour Market") suitable for end-user UI.
 *
 * The raw `merchant_key` is a normalized internal identifier; users should
 * never see it as-is.
 */
export function prettifyMerchant(key: string | null | undefined): string {
  if (!key) return '';
  return key
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
