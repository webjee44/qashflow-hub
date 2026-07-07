/**
 * isCurrentAccountLink — moteur pur.
 *
 * Détermine si un lien intercompany représente un vrai mouvement de COMPTE COURANT
 * (avance / apport / remboursement C/C) et non un paiement de facture pour compte
 * d'autrui, un simple virement bancaire non tagué, etc.
 *
 * Règle produit (décision owner) : une position n'est comptée que si les DEUX
 * jambes du lien sont catégorisées avec un libellé qui matche le motif C/C :
 *   - contient "c/c" (ex. "C/C Tradeflix", "Rbsmt C/C Max")
 *   - OU contient "compte courant" (ex. "Avance compte courant")
 *   - OU contient "apport" (ex. "Apport C/C Max Leho")
 *
 * Une jambe non catégorisée (category_name = null) est considérée comme NON C/C
 * et exclut le lien. La catégorisation auto IC-3 pose "C/C <Société>" sur les
 * jambes des liens confirmés / auto, donc l'exclusion des null vise uniquement
 * les liens dont une jambe a été manuellement recatégorisée en autre chose
 * (paiement de facture, achat, etc.) ou pas encore catégorisée.
 *
 * Aucune I/O, testable unitaire.
 */

const CURRENT_ACCOUNT_RE = /(?:^|[^a-z])c\/c(?:[^a-z]|$)|compte courant|apport/i;

export function isCurrentAccountCategoryName(name: string | null | undefined): boolean {
  if (!name) return false;
  return CURRENT_ACCOUNT_RE.test(name);
}

export interface LinkLegCategories {
  out_category_name: string | null;
  in_category_name: string | null;
}

export function isCurrentAccountLink(link: LinkLegCategories): boolean {
  return (
    isCurrentAccountCategoryName(link.out_category_name) &&
    isCurrentAccountCategoryName(link.in_category_name)
  );
}
