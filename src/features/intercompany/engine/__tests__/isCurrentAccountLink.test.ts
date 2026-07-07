import { describe, it, expect } from 'vitest';
import {
  isCurrentAccountCategoryName,
  isCurrentAccountLink,
} from '../isCurrentAccountLink';

describe('isCurrentAccountCategoryName', () => {
  it('accepte les libellés C/C', () => {
    expect(isCurrentAccountCategoryName('C/C Tradeflix')).toBe(true);
    expect(isCurrentAccountCategoryName('C/C Cloud Vapor')).toBe(true);
    expect(isCurrentAccountCategoryName('Rbsmt C/C Max Leho')).toBe(true);
  });

  it('accepte les libellés Apport', () => {
    expect(isCurrentAccountCategoryName('Apport C/C Max Leho')).toBe(true);
    expect(isCurrentAccountCategoryName('apport en capital')).toBe(true);
  });

  it('accepte les libellés Compte courant', () => {
    expect(isCurrentAccountCategoryName('Avance compte courant')).toBe(true);
    expect(isCurrentAccountCategoryName('Compte Courant Associé')).toBe(true);
  });

  it('rejette null / vide', () => {
    expect(isCurrentAccountCategoryName(null)).toBe(false);
    expect(isCurrentAccountCategoryName(undefined)).toBe(false);
    expect(isCurrentAccountCategoryName('')).toBe(false);
  });

  it('rejette les autres catégories', () => {
    expect(isCurrentAccountCategoryName('Virement intercompte')).toBe(false);
    expect(isCurrentAccountCategoryName('Achat marchandise')).toBe(false);
    expect(isCurrentAccountCategoryName('Salaires')).toBe(false);
    expect(isCurrentAccountCategoryName('Fournisseurs')).toBe(false);
  });

  it("ne matche pas c/c à l'intérieur d'un mot", () => {
    expect(isCurrentAccountCategoryName('abc/cde')).toBe(false);
  });
});

describe('isCurrentAccountLink', () => {
  it('vrai si les deux jambes sont C/C', () => {
    expect(
      isCurrentAccountLink({
        out_category_name: 'C/C Tradeflix',
        in_category_name: 'C/C Cloud Vapor',
      }),
    ).toBe(true);
  });

  it('faux si une jambe est autre chose (facture payée pour autrui)', () => {
    expect(
      isCurrentAccountLink({
        out_category_name: 'C/C Tradeflix',
        in_category_name: 'Achat marchandise',
      }),
    ).toBe(false);
  });

  it('faux si une jambe est null (non catégorisée)', () => {
    expect(
      isCurrentAccountLink({
        out_category_name: 'C/C Tradeflix',
        in_category_name: null,
      }),
    ).toBe(false);
    expect(
      isCurrentAccountLink({
        out_category_name: null,
        in_category_name: null,
      }),
    ).toBe(false);
  });
});
