## Objectif

Créer en SQL toutes les règles d'automatisation de catégorisation pour **SAS Vapeclub** (`3b65707f-aad4-4c09-a3c5-09d2a0163894`) à partir des 5 captures d'écran fournies.

## Mapping mots-clés → catégorie

Toutes les règles utilisent `condition_field = 'description'`, `condition_operator = 'contains'`, `action_type = 'categorize'`, `is_active = true`.

### Image 1 (10 règles)
| Mot clé | Catégorie cible |
|---|---|
| ERAG | Achats hors centrale |
| mutuel leasing | Leasing Peugeot |
| TVA | TVA |
| LOYER TPE | TPE |
| MALAKOFF | Retraite |
| fuu | Achats hors centrale |
| LTV | Leasing |
| PRO AA31473804 | Assurances |
| anthony | Salaires |
| lucile | Salaires |

### Image 2 (10 règles)
| Mot clé | Catégorie cible |
|---|---|
| SWILE | Tickets Restaurants |
| CLOUD | Achats hors centrale |
| CBM | Leasing |
| RDV- | Redevance Vapostore (5%) |
| REMISE CB 5091540010 | Ventes boutique Saint Brévin |
| REMISE CB 5882356015 | Ventes boutique les Sables |
| REMISE CB 1351371016 | Ventes boutique Pornic |
| AUTOROUTES | Frais de déplacement |
| LES PRO-IB FR PORNIC | Frais de déplacement |
| LE PHARE FR | Frais de déplacement |

### Image 3 (10 règles)
| Mot clé | Catégorie cible |
|---|---|
| PETRO-OUEST | Frais de déplacement |
| FOURNILDECHARLY | Frais de déplacement |
| BRIT'HOTEL FR | Frais de déplacement |
| BIG NOUNOURS | Frais de déplacement |
| ANGANI FR | Frais de déplacement |
| BEAUDART BENJAMIN | Salaires |
| VICTOR ET LOUIS FR | Frais de déplacement |
| TRAN SO FR | Frais de déplacement |
| TERZO FR | Frais de déplacement |
| SIGNORIZZA | Frais de déplacement |

### Image 4 (10 règles)
| Mot clé | Catégorie cible |
|---|---|
| Ica | Achats hors centrale |
| PETRO OUEST | Frais de déplacement |
| leho max | Rbsmt C/C Max Leho |
| TRADFLIX | Rbsmt C/C Tradeflix |
| Bouygues | Téléphones - Internet |
| BPPLUS | Travaux et architectes |
| MY PARTNER | Honoraires Comptabilité |
| Pacome Pidance | Salaires |
| Cassy Birotheau | Salaires |
| Lefevre Dylan | Salaires |

### Image 5 (9 règles)
| Mot clé | Catégorie cible |
|---|---|
| Jules Visset | Salaires |
| Damien Guillonn | Salaires |
| TPE735945201 | Ventes boutique La Montagne |
| PRLV SEPA VAPOSTORE | Achat Centrale |
| PRLV SEPA URSSAF | URSSAF |
| ECH PRET ASS | Remboursement Prêts |
| COMCB | Frais Bancaires |
| SAS SODIPOR | Loyer Pornic |
| AUDREY | Salaires |

**Total : 49 règles** (j'ai compté 49, pas 47 — Image 4 contient bien "PETRO OUEST" sans tiret en plus de "PETRO-OUEST" de l'Image 3).

## Note importante : URSSAF

La catégorie "URSSAF" n'existe pas dans la liste actuelle de SAS Vapeclub. Il faudra **la créer** comme sous-catégorie de **RH - Rémunération** (TVA 0%, type expense) avant d'ajouter la règle correspondante.

## Détails techniques

- L'`user_id` des règles sera celui du propriétaire de la société (récupéré depuis `companies.user_id` de SAS Vapeclub).
- Le moteur de matching (`automationRuleMatchingCore`) fait un `contains` insensible à la casse sur la description — les mots clés tels quels fonctionneront.
- Insertion via tool `supabase--insert` (pas une migration de schéma).
- Le `target_category_id` sera résolu via sous-requête `SELECT id FROM categories WHERE company_id = ... AND name = ...` pour garantir le bon mapping.
- Vérification finale : `SELECT COUNT(*) FROM automation_rules WHERE company_id = '...'` doit retourner 49.

## Étapes

1. Créer la catégorie "URSSAF" manquante (sous-catégorie de RH - Rémunération).
2. Insérer les 49 règles d'automatisation en une seule transaction SQL.
3. Vérifier le compte et lister un échantillon pour validation.
