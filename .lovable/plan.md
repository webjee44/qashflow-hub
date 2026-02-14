

## Remplissage complet des donnees demo - Treasury + IA

### Constat actuel

Le Business Plan est bien rempli pour les 3 societes (revenue streams, charges fixes, personnel, investissements, scenarios, financings). En revanche, le module tresorerie est **completement vide** :

| Donnee | ChaussuresPro | CloudSoft | StrategiaConseil |
|--------|:---:|:---:|:---:|
| Categories | 0 | 0 | 0 |
| Transactions | 0 | 0 | 0 |
| Regles IA | 0 | 0 | 0 |
| Previsions (category_forecasts) | 0 | 0 | 0 |
| Factures | 0 | 0 | 0 |

### Plan d'action

Creer une nouvelle fonction SQL `seed_demo_treasury` qui remplit toutes les donnees treasury pour les 3 societes demo. Cette fonction sera appelee via une migration SQL.

---

### Donnees a inserer par societe

#### 1. Categories (8-10 par societe)

Categories adaptees au profil metier de chaque societe :

- **ChaussuresPro** (Retail) : Ventes boutique, Ventes en ligne, Fournisseurs chaussures, Loyer boutique, Salaires, Marketing, Logiciels, Assurances, Frais bancaires
- **CloudSoft** (SaaS) : Abonnements SaaS, Services professionnels, Hebergement cloud, Salaires, Marketing digital, Loyer coworking, Logiciels, Frais bancaires
- **StrategiaConseil** (Conseil) : Missions conseil, Formations, Sous-traitance, Salaires, Deplacements, Loyer bureau, Logiciels, Frais bancaires

#### 2. Transactions (40-60 par societe, sur 6 mois : Sep 2025 - Fev 2026)

Transactions realistes avec descriptions detaillees, montants coherents, certaines categorisees (80%), d'autres non (20% pour montrer l'IA). Mix income/expense.

Exemples pour CloudSoft :
- "Abonnement mensuel - TechCorp SAS" +4 950 EUR (income)
- "AWS Hosting - Janvier" -1 180 EUR (expense)  
- "Virement salaires Janvier" -28 500 EUR (expense)

#### 3. Regles d'automatisation (4-6 par societe)

Regles actives avec `match_count > 0` pour montrer qu'elles fonctionnent :

- "Salaires mensuels" : description contient "salaire" -> Salaires (match_count: 12)
- "Abonnements SaaS" : description contient "abonnement" -> Logiciels (match_count: 8)
- "Loyer" : description contient "loyer" -> Loyer (match_count: 6)

#### 4. Previsions par categorie (category_forecasts, 6 mois futurs : Mar-Aout 2026)

Montants mensuels par categorie pour alimenter le tableau de previsions.

#### 5. Factures (8-12 par societe)

Mix factures clients (type: 'client') et fournisseurs (type: 'supplier'), statuts varies (pending, paid, overdue).

---

### Implementation technique

**Fichier** : Migration SQL unique

La migration executera directement les INSERT statements pour les 3 company_id connus :
- ChaussuresPro : `b73a714c-ed37-47fb-a811-85937f4174d2`
- CloudSoft : `da766438-35f4-496a-aba5-4f372ad9e391`
- StrategiaConseil : `95c8c816-3954-4181-af68-c8cda7fd2dba`

User ID demo : `2ab6f6c5-7efb-47ba-aede-b6c2b950b679`

La migration :
1. Verifie que les categories n'existent pas deja (idempotent)
2. Insere les categories et stocke leurs IDs dans des variables
3. Insere les transactions avec references aux categories
4. Insere les regles d'automatisation
5. Insere les previsions par categorie
6. Insere les factures

### Volume total estime

| Element | Par societe | Total |
|---------|:-----------:|:-----:|
| Categories | ~10 | ~30 |
| Transactions | ~50 | ~150 |
| Regles IA | ~5 | ~15 |
| Previsions | ~60 (10 cat x 6 mois) | ~180 |
| Factures | ~10 | ~30 |

### Resultat attendu

En se connectant au tenant demo, l'utilisateur verra :
- Un dashboard avec des vrais chiffres (solde, encaissements, decaissements)
- Une courbe de tresorerie avec historique et projection
- Des transactions categorisees avec confiance IA
- Des regles d'automatisation actives avec compteurs
- Un tableau de previsions rempli par categorie
- Des factures clients et fournisseurs avec statuts varies
- Le tout coherent entre les 3 societes

