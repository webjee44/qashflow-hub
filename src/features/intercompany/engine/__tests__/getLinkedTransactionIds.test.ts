import { describe, it, expect } from 'vitest';
import {
  getLinkedTransactionIds,
  type LinkForNeutralization,
} from '../getLinkedTransactionIds';

const l = (
  tx_out_id: string,
  tx_in_id: string,
  status: LinkForNeutralization['status'] = 'auto_matched',
): LinkForNeutralization => ({ tx_out_id, tx_in_id, status });

describe('getLinkedTransactionIds', () => {
  it('agrège les deux jambes de chaque lien inclus', () => {
    const set = getLinkedTransactionIds([l('a', 'b'), l('c', 'd', 'confirmed')]);
    expect(set.size).toBe(4);
    expect(set.has('a')).toBe(true);
    expect(set.has('d')).toBe(true);
  });

  it('exclut suggested et rejected par défaut', () => {
    const set = getLinkedTransactionIds([
      l('a', 'b', 'auto_matched'),
      l('c', 'd', 'suggested'),
      l('e', 'f', 'rejected'),
    ]);
    expect(set.size).toBe(2);
    expect(set.has('a')).toBe(true);
    expect(set.has('c')).toBe(false);
    expect(set.has('e')).toBe(false);
  });

  it('respecte le paramètre statuses', () => {
    const set = getLinkedTransactionIds(
      [l('a', 'b', 'auto_matched'), l('c', 'd', 'suggested')],
      ['suggested'],
    );
    expect(set.size).toBe(2);
    expect(set.has('c')).toBe(true);
    expect(set.has('a')).toBe(false);
  });

  it('retourne un set vide sur input vide', () => {
    expect(getLinkedTransactionIds([]).size).toBe(0);
  });
});
