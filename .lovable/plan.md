## Cause racine

Le calcul `45% × CA HT` est correct dans le code, mais les **données d'entrée du CA sont incohérentes** :

**Cas Mai 2026 / Cloud Vapor :**
- Catégorie "Ventes" : `vat_rate = 0%`, ligne stockée avec `amount_basis = 'ht'`, montant = 280 000
- L'utilisateur saisit 280 000 en pensant **TTC** (cohérent avec la convention d'affichage TTC du tableau)
- Le système, lui, lit `amount_basis='ht'` + `vat_rate=0` → considère que CA HT = 280 000
- Résultat : 45% × (280 000 + 6 472) = **128 912 HT → ~154 694 TTC affiché** (au lieu des 104 999 attendus)

Deux problèmes systémiques sont révélés :

1. **Incohérence du `amount_basis`** : la mutation de sauvegarde écrit toujours `'ttc'` (cf `useForecasts.ts` L250), mais des lignes historiques (BP import, anciennes saisies, demo) sont en `'ht'`. La convention "tout TTC" n'est donc pas appliquée uniformément.
2. **`vat_rate = 0` sur la catégorie "Ventes"** masque le bug : avec TVA 0, HT = TTC, donc la conversion silencieuse n'a aucun effet visible jusqu'à ce qu'un calcul dérivé (le % CA) ait besoin du vrai HT.

Le tableau est censé être 100% TTC en saisie comme en affichage (convention `cash-flow-standard`). Le calcul variable doit dériver le HT à partir du TTC saisi en utilisant la TVA de la catégorie de revenu.

## Solution proposée

### 1. Source de vérité unique : `amount_basis = 'ttc'` partout

Ajouter une migration qui **normalise toutes les lignes existantes de `category_forecasts` en TTC** :

```sql
-- Pour chaque ligne en 'ht', convertir le montant en TTC en appliquant la TVA de la catégorie
UPDATE category_forecasts cf
SET expected_amount = cf.expected_amount * (1 + COALESCE(c.vat_rate, 0)),
    amount_basis = 'ttc'
FROM categories c
WHERE cf.category_id = c.id AND cf.amount_basis = 'ht';
```

Effet : toutes les saisies historiques deviennent cohérentes avec la convention de saisie actuelle. Le `amount_basis` reste dans le schéma comme garde-fou, mais devient de facto toujours `'ttc'`.

### 2. Garantir la TVA correcte sur les catégories de revenu

Le vrai HT du CA dépend de la TVA de la catégorie. Si "Ventes" reste à 0%, alors 280 000 TTC = 280 000 HT pour le système → impossible d'obtenir 233 333.

Deux options à arbitrer avec l'utilisateur (voir question ci-dessous).

### 3. Renforcer la convention dans le code

Dans `useForecasts.ts`, le calcul `getForecast` pour `percent_of_revenue` calcule déjà sur HT puis convertit en TTC. Aucun changement de logique nécessaire **après** normalisation des données. On peut toutefois :

- Ajouter un test unitaire dans `forecastAmounts.test.ts` couvrant exactement le cas "280k TTC saisis, TVA 20%, 45% → 104 999 HT → 125 999 TTC".
- Garder `toHt`/`toTtc` comme seules portes d'entrée/sortie (déjà le cas).

### 4. UX : rendre la saisie explicite

Afficher un libellé "TTC" à côté des cellules de prévision de revenus (pas seulement dans le tooltip), pour qu'aucun utilisateur ne puisse plus saisir "280 000" en pensant HT alors que le tableau attend du TTC.

## Question à arbitrer

Pour que 280 000 € TTC saisis en "Ventes" donnent bien 233 333 € HT, il faut que la catégorie "Ventes" porte la bonne TVA (20%). Aujourd'hui elle est à 0%.

Je propose de demander confirmation : passer "Ventes" (et toute catégorie de revenu actuellement à 0%) à 20% par défaut, ou laisser l'utilisateur ajuster manuellement dans /paramètres après la migration.

## Fichiers impactés

- `supabase/migrations/<timestamp>_normalize_forecast_basis_to_ttc.sql` (nouveau)
- `src/lib/forecastAmounts.test.ts` (ajout test cas réel)
- `src/components/forecasts/ForecastTable.tsx` (ajout libellé "TTC" sur cellules revenu)
- Mémoire `mem://features/treasury/cash-flow-standard` à mettre à jour : "amount_basis est désormais toujours 'ttc' ; le HT est dérivé via la TVA de la catégorie"

## Risques de régression

- Catégories avec `vat_rate > 0` qui auraient été saisies en TTC mais stockées en HT par erreur seront re-converties (montant gonflé). À vérifier sur Cloud Vapor + Vapeclub avant migration. Je ferai un `SELECT` de contrôle préalable et le partagerai pour validation avant exécution.
- Les imports BP créent des lignes via `bp_synced` : vérifier que la pipeline d'import écrit bien en TTC (sinon corriger côté import également).

## Pas de patch local

Aucune valeur en dur, aucun cas particulier. La fix s'attaque à la cohérence des données et de la convention TTC déjà documentée.
