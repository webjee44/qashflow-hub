## Objectif

Calculer automatiquement la **TVA à décaisser** dans les Prévisions, en respectant la règle métier française (TVA de M payée en M+1, régime réel mensuel), **sans jamais doublonner** avec le prélèvement DGFIP réel — qui sera catégorisé via une règle d'automation dédiée.

## Architecture

### 1. Catégorie système "TVA à payer"

- Nouvelle colonne `categories.is_vat_payment boolean default false`
- Catégorie créée automatiquement pour toute société (migration rétroactive + ajout dans `handle_new_user()`)
- Type `expense`, `vat_rate = 0`, icône dédiée, non supprimable côté UI
- **Une seule** par société (contrainte unique partielle `WHERE is_vat_payment`)

### 2. Régime de TVA au niveau société

- Nouvelle colonne `companies.vat_regime text default 'monthly_real'`
- V1 supportée : `monthly_real` (paiement M+1) et `franchise` (pas de TVA)
- Sélecteur dans **Paramètres > Société**
- Trimestriel/simplifié signalés "à venir" (fallback monthly_real)

### 3. Helper pur `forecastVat.ts`

```ts
getVatPayment(month, regime, getNetVatForecast, vatCreditCarry) →
  { payment: number, newCarry: number }
```

- `monthly_real` : `payment = max(0, NetVat(M-1) - carry)` ; si négatif → carry s'accumule
- `franchise` : toujours 0
- 100% testable, sans I/O

### 4. Intégration dans `useForecasts.ts`

Nouveau dérivé `getVatPaymentLine(month)` qui applique la règle **actual écrase forecast** déjà en vigueur partout dans le produit :

```
actual(M) = somme transactions catégorisées is_vat_payment sur M
forecast(M) = getVatPayment(M, regime, ...)

displayed(M) = actual(M) si M ≤ moisCourant et actual > 0
            sinon forecast(M)
```

Aucune logique nouvelle : c'est exactement le contrat `actuals consistency` appliqué à une catégorie de plus.

### 5. Affichage dans `ForecastTable.tsx`

La ligne "TVA à décaisser" actuelle (L1697-1747) cesse d'être informative et **devient une vraie sortie de cash** intégrée dans `getDisplayedNetVariation`. Visuellement alignée avec les autres dépenses, non éditable, avec icône info expliquant la règle.

### 6. Suppression du double comptage

`forecastDisplayTotals.ts` : retirer le commentaire "non comptée dans les flux" (L15-20) et inclure `vatPayment(M)` dans la variation nette. Le solde projeté reflète enfin la vraie sortie TVA.

### 7. UX automation pour DGFIP

Pas de code spécial — l'UI d'automation existe déjà. L'utilisateur :
1. Va dans Automations
2. Crée la règle "Description contient DGFIP → TVA à payer"
3. Clique "Appliquer aux transactions existantes" (bouton existant)

Tous les anciens prélèvements basculent vers la bonne catégorie en un clic.

## Fichiers impactés

**Migration**
- `supabase/migrations/<ts>_add_vat_automation.sql`
  - `ALTER TABLE categories ADD COLUMN is_vat_payment boolean default false`
  - `ALTER TABLE companies ADD COLUMN vat_regime text default 'monthly_real'`
  - `CREATE UNIQUE INDEX ... ON categories (company_id) WHERE is_vat_payment`
  - `INSERT` catégorie "TVA à payer" pour toutes les sociétés existantes
  - Modifier `handle_new_user()` pour créer la catégorie à chaque nouveau compte

**Logique pure (testée)**
- `src/lib/forecastVat.ts` (nouveau)
- `src/lib/forecastVat.test.ts` (nouveau) — cas mensuel, crédit reporté, franchise, actual écrase forecast

**Hooks / composants**
- `src/hooks/useForecasts.ts` — exposer `getVatPaymentLine(month)`
- `src/lib/forecastDisplayTotals.ts` — inclure vatPayment dans la variation nette
- `src/components/forecasts/ForecastTable.tsx` — réécriture ligne TVA (L1697-1747)
- `src/components/forecasts/ForecastChart.tsx` — utiliser `vatPayment` à la place de `netVat`
- `src/pages/Settings.tsx` — sélecteur "Régime de TVA"

**Mémoire**
- `mem://features/treasury/cash-flow-standard` — documenter dérivation TVA M+1
- Nouveau `mem://features/treasury/vat-payment-derivation` — règle complète

## Garanties anti-régression

- **Zéro doublon** : la ligne dérivée alimente uniquement la catégorie `is_vat_payment` ; "Impôts et taxes" reste séparé pour IS/CFE
- **Actual prime** : règle déjà en place ailleurs, on l'applique sans exception
- **Crédit TVA** : géré par `vatCreditCarry` cumulatif, pas de cas particulier
- **Sociétés en franchise** : ligne masquée/à zéro, aucun impact
- **Tests unitaires** sur tous les cas de figure avant merge
- **Aucune valeur en dur**, aucune duplication de logique, aucun patch local

## Estimation

Une itération propre : migration + helper testé + intégration + UX paramètres.

Je suis prêt à implémenter. Tu approuves ?
