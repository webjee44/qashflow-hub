## Contexte

Aujourd'hui le moteur BP est figé à **24 mois / 3 exercices fiscaux de 12 mois**, alignés sur l'année calendaire de `bp_start_date`. Cas E-fumeur Internet :

- Démarrage : **Septembre 2025**
- Fin Y1 : **31 Décembre 2026** (premier exercice long de 16 mois — légal en France, max 24 mois pour une création)
- Y2 : 2027 complet (12 mois)
- Y3 : 2028 complet (12 mois)
- Total : **40 mois projetés**

Le pattern "premier exercice long" est universel (toute SAS/SARL créée hors janvier l'utilise). Le résoudre proprement débloque tous les futurs BP, pas juste E-fumeur.

## Cause racine

`bp_settings` stocke déjà `bp_start_date`, `bp_years`, `fiscal_year_start_month`, `fiscal_year_start_day` — mais le moteur ignore ces champs et applique partout 24 mois calendaires. Il manque **un seul concept métier** : la **date de fin du premier exercice fiscal** (`first_fiscal_year_end_date`).

À partir de là, tout se déduit :
- Durée Y1 = `first_fiscal_year_end_date - bp_start_date`
- Y2, Y3 = 12 mois calendaires à partir de la fin Y1
- Total mois projetés = somme des 3 exercices

## Plan technique

### 1. Schéma DB (migration)
Ajouter sur `bp_settings` :
- `first_fiscal_year_end_date date` (nullable, fallback = 31/12 de l'année de `bp_start_date`)
- Trigger de cohérence : Y1 entre 1 et 24 mois.

### 2. Moteur (`src/features/business-plan/engine/`)
- `buildPeriodAxis()` : nouvelle fonction qui construit la liste `months[]` + `fiscalYears[{ index, startDate, endDate, monthCount }]` depuis `bp_start_date` + `first_fiscal_year_end_date` + `bp_years`.
- Remplacer toutes les boucles "24 mois" / "année 1, 2, 3 = 12 mois" par cet axe partagé : `computePL`, `computeCashFlow`, `computeBalanceSheet`, `computeFundingPlan`, `computeRatios`, `loanSchedule`.
- Validator : assouplir contrainte 24 mois.

### 3. Hooks & sélecteurs
- `useBPSettings` : exposer `firstFiscalYearEndDate` + helper `getFiscalYears()`.
- Tous les sélecteurs annuels (`useBPRatios`, `useProfitLoss`, etc.) consomment l'axe.

### 4. UI
- `BPWizardStep1Settings.tsx` : ajouter un champ **"Date de clôture du 1er exercice"** (par défaut 31/12 de l'année de démarrage). Validation visuelle si Y1 > 12 mois → badge "Premier exercice long".
- Affichage colonne année : `Y1 (Sept 25 → Déc 26 — 16 mois)`, `Y2 (2027)`, `Y3 (2028)`.
- Suppression du sélecteur "3 ans / 5 ans / 7 ans" actuellement non câblé OU on le garde mais on le borne réellement (max 3 exercices reste la règle business).

### 5. PDF
- `PnlSection.tsx`, `CashFlowSection.tsx`, etc. consomment le même axe → libellés cohérents.
- Encadré pédagogique : adapter les % YoY pour qu'ils tiennent compte de la durée Y1 (annualisation pour comparaison juste).

### 6. Mémoire produit
Mettre à jour la règle core "Hardcoded to 24 months / 3 fiscal years" → "**3 exercices fiscaux, Y1 entre 1 et 24 mois (premier exercice long supporté), Y2 et Y3 calendaires**".

## Impacts & non-régressions

- Tous les BP existants : `first_fiscal_year_end_date = bp_start_date.year-12-31` par défaut → comportement identique au 24 mois actuel pour les BP démarrés en janvier, et les BP en cours seront automatiquement migrés (Y1 partiel jusqu'à fin année calendaire — ce qui est déjà ce que les utilisateurs voient).
- Tests unitaires `engine/` à étendre : cas Y1 = 4 mois, Y1 = 12 mois, Y1 = 16 mois, Y1 = 24 mois.

## Après merge

J'enchaîne sur la mise à jour des données E-fumeur (CA, charges, équipe, invest, financements, stocks) avec le nouvel axe Y1=16 mois.

## Question avant de coder

Veux-tu que j'embarque aussi dans cette PR la **suppression du sélecteur "3/5/7 ans"** dans le wizard (pour aligner le produit sur la règle "toujours 3 exercices") ou on le laisse pour une PR ultérieure ?