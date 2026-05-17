/**
 * Internal transfer convention (cf. mémoire treasury-internal-transfer-neutralization-logic):
 * marked by the system category named "Virement intercompte".
 */
export const INTERNAL_TRANSFER_CATEGORY_NAME = 'Virement intercompte';

export interface InternalTransferLike {
  categoryName?: string | null;
}

export function isInternalTransfer(tx: InternalTransferLike): boolean {
  return tx.categoryName === INTERNAL_TRANSFER_CATEGORY_NAME;
}
