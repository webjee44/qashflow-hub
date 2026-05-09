## Objectif
Classer toutes les charges de Cloud Vapor selon le Plan Comptable Général français (PCG), en remplissant la colonne `pcg_subcategory` et en corrigeant la `category` interne quand elle est mal positionnée.

## Charges variables (3)

| Ligne | Code PCG | Action |
|---|---|---|
| Achats laboratoire (44.3% CA) | **6071** Achats de marchandises | Déjà OK, je confirme |
| Frais Payplug (0.22%) | **6275** Commissions cartes bancaires | Ajouter PCG + corriger category `payment_fees` |
| Transport sur ventes (2.8%) | **6242** Transports sur ventes | Ajouter PCG + corriger category `shipping` |

## Charges fixes (37)

### Locations & immobilier
| Ligne | PCG |
|---|---|
| Locations immobilières (13 190€) | **6132** Locations immobilières |
| Charges locatives & copropriété (794€) | **614** Charges locatives et copropriété |
| Location GRENKE (3 616€) | **6135** Locations mobilières |
| Location Peugeot 308 (822€) | **6135** Locations mobilières (véhicule) |
| Crédit-bail Ford GS250MR (680€) | **6122** Crédit-bail mobilier |
| Crédit-bail mat. informatique (237€) | **6122** Crédit-bail mobilier |

### Entretien, énergie, fournitures
| Ligne | PCG |
|---|---|
| Entretien & maintenance (733€) | **6152** Entretien & réparations sur biens immobiliers |
| Énergie & carburants (363€) | **6061** Fournitures non stockables (eau, énergie) |
| Fournitures administratives (222€) | **6064** Fournitures administratives |
| Fournitures entretien (60€) | **6068** Autres matières et fournitures |
| Packaging & emballages (2 911€) | **60267** Emballages perdus (expédition produits) |

### Honoraires & sous-traitance
| Ligne | PCG |
|---|---|
| Honoraires divers (1 984€) | **6228** Honoraires divers (mixte) |
| Refacturation Frédérique holding 50% (2 508€) | **628** Divers (management fees intra-groupe) |
| **Rémunération présidence facturée par holding (3 614€)** | **628** Divers (management fees présidence personne morale) — voir note |
| Sous-traitance administrative (1 470€) | **6041** Achats prestations de services |
| Sous-traitance sociale (200€) | **6041** Achats prestations de services |
| Personnel intérimaire (203€) | **6211** Personnel intérimaire |

### Marketing
| Ligne | PCG |
|---|---|
| Publicité & annonces (3 434€) | **6231** Annonces et insertions |
| Cadeaux clientèle (2 055€) | **6234** Cadeaux à la clientèle |
| Réceptions (166€) | **6257** Réceptions |

### Logiciels & licences
| Ligne | PCG |
|---|---|
| Location licences logicielles (2 407€) | **6511** Redevances licences |
| Redevances brevets & licences (206€) | **6516** Droits d'auteur et de reproduction |

### Assurances, banque, télécom, transport
| Ligne | PCG |
|---|---|
| Primes d'assurance (1 042€) | **6161** Multirisques |
| Services bancaires (828€) | **627** Services bancaires |
| Téléphone & internet (156€) | **626** Frais postaux et télécoms |
| Transports sur achats (37€) | **6241** Transports sur achats |
| Voyages & déplacements (121€) | **6251** Voyages et déplacements |

### Impôts & taxes (classe 63)
| Ligne | PCG |
|---|---|
| Taxe d'apprentissage (75€) | **6312** Taxe d'apprentissage |
| Contribution employeur formation (63€) | **6313** Participation formation continue |
| Fonds paritarisme (11€) | **6358** Autres impôts et taxes |
| Taxes foncières (958€) | **6354** Taxes foncières |
| Taxe véhicules sociétés (1€) | **63514** TVS |

### Divers
| Ligne | PCG |
|---|---|
| Cotisations & concours divers (353€) | **6281** Cotisations professionnelles |
| Documentation (14€) | **6183** Documentation générale |
| Formation professionnelle (61€) | **6184** Formation du personnel |
| Frais d'entreprise (145€) | **6257** Réceptions / frais professionnels |
| Ajustement charges externes (12 647€) | **6288** Charges externes diverses |

## Note importante : Rémunération présidence (3 614€)

Tu m'as précisé que c'est **la holding (personne morale) qui facture la présidence** à Cloud Vapor. Comptablement, ce ne sont **pas** des charges de personnel (642/644) mais des **honoraires de management fees** facturés par une autre société. Je vais donc :
- **Garder** la ligne dans `bp_fixed_expenses` (catégorie `professional_fees`)
- L'affecter au compte **628** « Divers » (sous-compte usuellement 6286 ou 62286 selon les plans, mais 628/6228 reste le standard PCG officiel)
- Ajouter une note explicative : *"Management fees facturés par la holding pour le mandat de présidence (personne morale)"*

Idem pour la **Refacturation Frédérique holding 50%** : management fees → **628**.

## Périmètre technique

- 1 seul appel SQL `UPDATE` groupé sur `bp_fixed_expenses` (37 lignes) + 1 sur `bp_variable_expenses` (3 lignes), filtrés par `company_id = 12ea5853-35f4-46d3-a97d-3d8f466e59d8`
- Aucune modification de schéma, aucun code frontend touché
- Les changements sont visibles immédiatement dans le P&L (regroupement par compte PCG via `CATEGORY_TO_PCG_MAPPING`)
