/**
 * getLinkedTransactionIds — module pur.
 *
 * Retourne l'ensemble des IDs de transactions qui font partie d'un lien
 * intercompany dont le statut est inclus dans `statuses`.
 *
 * Utilisé exclusivement pour la NEUTRALISATION des flux intergroupes dans
 * les agrégats CONSOLIDÉS (vue groupe). Ne touche jamais aux trésoreries
 * par société : un interco est un vrai flux au niveau d'une société isolée.
 */

import type { IntercompanyLinkStatus } from './computeIntercompanyPositions';

export interface LinkForNeutralization {
  tx_out_id: string;
  tx_in_id: string;
  status: IntercompanyLinkStatus;
}

const DEFAULT_STATUSES: IntercompanyLinkStatus[] = ['auto_matched', 'confirmed'];

export function getLinkedTransactionIds(
  links: LinkForNeutralization[],
  statuses: IntercompanyLinkStatus[] = DEFAULT_STATUSES,
): Set<string> {
  const set = new Set<string>();
  const allowed = new Set(statuses);
  for (const l of links) {
    if (!allowed.has(l.status)) continue;
    set.add(l.tx_out_id);
    set.add(l.tx_in_id);
  }
  return set;
}
