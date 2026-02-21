

# Correction de la "Variation nette du mois" -- plan d'action

## Diagnostic

L'analyse de la base de donnees revele **deux bugs majeurs** dans le calcul des actuals du tableau de previsions. Cloud Vapor est le plus touche mais d'autres societes sont aussi affectees.

### Bug 1 (critique) : Melange type de transaction / type de categorie

La categorie "Ventes" (type `income`) de Cloud Vapor contient des transactions des DEUX types :
- 380 520 EUR de transactions `income` (encaissements clients)
- 339 692 EUR de transactions `expense` (achats fournisseurs)

Le code dans `useForecasts.ts` somme aveuglements TOUS les montants par `category_id` sans filtrer par `tx.type` :

```text
actuals["Ventes"]["2026-01"] = 720 212 EUR  (income + expense)
```

Resultat : `getMonthTotal('income', ...)` gonfle les encaissements de 340K EUR, et `getMonthTotal('expense', ...)` les ignore completement. La variation nette est faussee.

Societes impactees (donnees reelles) :

| Societe           | Transactions mal comptees | Montant       |
|---|---|---|
| Cloud Vapor       | 137                       | 1 030 735 EUR |
| E-fumeur Internet | 28                        | 50 209 EUR    |
| Coachflix          | 14                        | 56 670 EUR    |
| Tradeflix          | 1                         | 29 197 EUR    |
| Vapeflix           | 1                         | 1 000 EUR     |

### Bug 2 (secondaire) : TVA ajoutee sur des montants deja TTC

Pour les mois passes, les montants des transactions bancaires sont deja TTC. Mais le code calcule :

```text
actualTtc = actualHt + actualVat    -- FAUX : actualHt est deja TTC !
```

Cela gonfle artificiellement les totaux TTC et la variation nette (ecart visible uniquement sur les categories avec `vat_rate > 0`).

### Bug 3 (bloquant) : Colonne `is_system` jamais creee

La migration SQL a echoue silencieusement. La colonne `is_system` n'existe pas dans la base, ce qui empeche toute la logique "Virement intercompte" de fonctionner. Il faut la re-creer.

---

## Corrections prevues

### Etape 1 -- Corriger le calcul des actuals (useForecasts.ts)

Modifier la requete `actuals` pour separer les montants par type de transaction :

```text
Avant :  grouped[category_id][month] += amount
Apres :  grouped[category_id][month] = { income: X, expense: Y }
```

Modifier `getActual(categoryId, month)` pour accepter un parametre `type` optionnel et ne retourner que les montants correspondants au type de la categorie. `getMonthTotal('income', ...)` utilisera uniquement la partie `income` et vice versa.

Fichier : `src/hooks/useForecasts.ts`

### Etape 2 -- Supprimer la TVA sur les actuals

Les montants bancaires sont TTC. Pour les calculs de totaux sur les mois passes :
- `renderTtcRow` : `actualTtc = actualHt` (pas de `+ actualVat`)
- `renderNetRow` : idem, ne pas ajouter `incomeVat` / `expenseVat` sur les actuals
- `renderSectionHeaderRow` : idem
- `getVatActual` : garde pour l'affichage informatif de la ligne "TVA collectee/deductible" mais ne l'injecter nulle part dans les totaux

Fichier : `src/components/forecasts/ForecastTable.tsx`

### Etape 3 -- Re-creer la colonne `is_system`

Nouvelle migration SQL :
```sql
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';
```

### Etape 4 -- Aligner getMonthNetForecast (useForecasts.ts)

La fonction `getMonthNetForecast` (utilisee pour le calcul du solde projete) itere sur TOUTES les categories y compris systeme. Ajouter un filtre `!cat.is_system` pour exclure "Virement intercompte" des projections.

Idem pour `getVatForecast` et `getVatActual` qui ne doivent pas inclure les categories systeme.

Fichier : `src/hooks/useForecasts.ts`

---

## Resume des fichiers modifies

| Fichier | Modification |
|---|---|
| `src/hooks/useForecasts.ts` | Actuals groupes par tx.type ; getActual type-aware ; filtre is_system dans getMonthNetForecast, getVatForecast, getVatActual |
| `src/components/forecasts/ForecastTable.tsx` | Suppression ajout VAT sur actuals dans renderTtcRow, renderNetRow, renderSectionHeaderRow |
| Migration SQL | Re-creation colonne `is_system` |

## Impact attendu

- La variation nette des mois passes correspondra exactement a : somme des encaissements reels - somme des decaissements reels
- Les totaux TTC des mois passes refleront les montants bancaires sans TVA fantome
- Toutes les organisations seront corrigees, pas seulement Cloud Vapor

