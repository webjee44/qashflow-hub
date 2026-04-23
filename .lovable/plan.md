

## Confirmation : non, les 190 000 € ne sont pas du TTC

### Constat

Sur `/previsions`, la ligne **Encaissements** affiche actuellement les montants **HT**, pas TTC.

- Les cellules de saisie de chaque catégorie sont libellées "HT" (cf. `features/treasury/cash-flow-standard`).
- `getMonthTotal('income', …, 'forecast')` (`ForecastTable.tsx` L417) fait juste la somme brute des `expected_amount` saisis → donc HT.
- La ligne TTC additionne ces totaux + la TVA nette **uniquement côté dépenses** (L1500-1504). Côté encaissements, aucune TVA n'est rajoutée.
- Conséquence : sur Cloud Vapor, les **190 000 €** d'avril 2026 = **190 000 € HT**, et la ligne ADNS à 50 % = 95 000 € (50 % × HT), ce qui est cohérent avec le moteur actuel mais **pas avec ta vision "trésorerie = TTC"**.

C'est précisément l'incohérence que tu pointais sur ADNS : le tableau est étiqueté/calculé en HT alors que tu le lis (à juste titre métier) comme un tableau de trésorerie en TTC.

### Cause racine

Décision d'archi prise il y a ~7 semaines (memory `cash-flow-standard`) : tout en HT dans le tableau, TVA ajoutée seulement pour le solde net. Cela contredit la définition standard d'un plan de trésorerie (flux bancaires réels = TTC).

### Plan de correction (à valider avant implémentation)

**Objectif** : aligner le tableau Prévisions sur la convention trésorerie standard = **TTC** sur toutes les lignes de flux, comme tu l'attends.

#### 1. Source de vérité — convention de stockage
- `category_forecasts.expected_amount` : ajouter une colonne `amount_basis` (`'ht' | 'ttc'`, défaut `'ttc'`) pour ne **pas casser** les données existantes (qui sont en HT) lors de la migration.
- Migration : marquer toutes les lignes existantes `amount_basis = 'ht'` (état actuel préservé).
- Nouvelles saisies : `'ttc'` par défaut.

#### 2. Couche de calcul unifiée (`src/lib/forecastAmounts.ts` — nouveau)
- Fonction unique `toTtc(amount, basis, vatRate)` et `toHt(...)`.
- Utilisée par **toutes** les couches : `useForecasts`, `ForecastTable`, `BalanceChart`, export Excel, `useBPCashFlow` côté BP, edge functions.

#### 3. UI — cellules de saisie
- Label des cellules : "TTC" (au lieu de "HT").
- Affichage : tout le tableau en TTC.
- Tooltip / petit toggle global "Voir en HT" pour les utilisateurs qui veulent l'autre vue (lecture seule).

#### 4. Calcul "% du CA" (catégories en mode `percent_of_revenue`)
- Base de calcul = **CA TTC du mois** (cohérent avec la nouvelle convention).
- Sur Cloud Vapor : ADNS = 50 % × 228 000 € TTC (190 000 HT × 1,20) = **114 000 € TTC**.

#### 5. Ligne "TVA nette à payer"
- Devient redondante côté encaissements/décaissements (déjà incluse dans le TTC).
- Conservée uniquement comme ligne d'**information** (déclaration TVA), retirée du calcul de la trésorerie nette pour éviter le double comptage.
- Le solde de clôture reste : `ouverture + (encaissements TTC − décaissements TTC) = clôture`. Invariant préservé.

#### 6. Migration douce des données existantes
- Script one-shot (admin) qui propose de convertir les `expected_amount` HT existants → TTC en multipliant par `1 + category.vat_rate`. Optionnel par société, déclenchable depuis Settings.
- Tant que non migré : la colonne `amount_basis = 'ht'` permet au calcul unifié de continuer à afficher correctement (conversion à la volée).

#### 7. Tests
- `forecastAmounts.test.ts` : conversions HT⇄TTC.
- Mise à jour `forecastDisplayTotals.test.ts` : nouveaux cas TTC + invariant `ouverture + net = clôture`.
- Test de non-régression sur Cloud Vapor : ADNS avril 2026 = 114 000 € TTC.

#### 8. Mémoire à mettre à jour
- Réécrire `features/treasury/cash-flow-standard` : "Le tableau Prévisions affiche en TTC. La TVA nette à payer est une ligne informative séparée."

### Impacts
- **BP / Cash Flow BP** (`useBPCashFlow`) : reste en HT côté saisies BP, mais conversion TTC pour les flux trésorerie projetés (déjà partiellement le cas via `customer_payment_delay`).
- **Dashboard `BalanceChart`** : utilise `useForecasts` → bénéficie automatiquement.
- **Export Excel** : libellés colonnes mis à jour ("TTC").
- **Aucun impact** sur la catégorisation des transactions bancaires (déjà TTC nativement).

### Hors périmètre
- Pas de changement sur le P&L BP (reste HT, c'est la norme comptable).
- Pas de changement sur les factures Pennylane/Odoo.

