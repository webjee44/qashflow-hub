## Contexte

L'audit comptable confirme et précise le diagnostic CTO. Les PR 1 (moteur unifié), 3 (validateur) et 4 (PDF) déjà planifiés couvrent une partie. L'audit ajoute 4 corrections structurelles que j'intègre dans une **PR 2 enrichie** (les 5 lots existants + 4 nouveaux), et précise les invariants attendus pour PR 3.

Pas de "tout refaire d'un coup". Chaque lot reste atomique, testable contre `cloud-vapor.json`, sans régression silencieuse.

## Roadmap consolidée

```text
PR 0  ✅ Fixtures + invariants Cloud Vapor
PR 1  ✅ Moteur unifié computeBPModel
PR 2  📋 Corrections financières (9 lots, voir ci-dessous)
PR 3  📋 Validateur de réconciliation (8 invariants bloquants)
PR 4  📋 Refonte PDF qualité expert-comptable
```

## PR 2 — Lots détaillés (ordre d'exécution)

### Lot 2.0 — `normalizeRate` partout (préalable)
Centraliser dans `src/lib/rateUtils.ts` (déjà existant). Audit complet : remplacer toute lecture brute de `growth_rate`, `churn_rate`, `employer_charges_rate`, `interest_rate`, `vat_rate`, `charges_rate`, `percentage` par `normalizeRate(value)`. Test unitaire dédié couvrant `null/undefined/0.10/10/100/-5`.
**Risque** : faible. **Impact** : élimine le risque de mix format 0.10 vs 10.

### Lot 2.1 — Bilan dérive trésorerie depuis Cash Flow (source unique)
`computeBalanceSheet` reçoit `cashFlowData`. La ligne "Trésorerie" devient `cashFlow.balance[lastMonthOfYear]`. Plus de calcul par soustraction d'équilibre.
**Invariant testé** : `bs.cash[i] === cf.balance[lastMonth(i)]`.

### Lot 2.2 — Classification stricte des charges variables (anti double-comptage)
Une seule famille par charge : règle unique `isCogs = category === 'cogs' || is_cogs === true`. Suppression de toute logique implicite. Les charges non-COGS vont en services extérieurs (61/62), pas ailleurs.
**Invariant testé** : `Σ(charges par nature) === pl.totals.operatingExpenses`.

### Lot 2.3 — Tableau d'amortissement d'emprunt unique
Nouvelle fonction pure `buildLoanSchedule(financing) → { interest[], principal[], remaining[] }`. Réutilisée par P&L (intérêts → 66), cash flow (capital + intérêts), bilan (capital restant dû), plan de financement (remboursement capital).
**Invariant testé** : `bankLoans[i-1] - bankLoans[i] === Σ principal year i` ET `cf.loanPayments year = Σ(interest + principal) year` ET `fundingPlan.loanRepayment = Σ principal`.

### Lot 2.4 — Stop double-comptage charges sociales personnel
Convention unique :
- `personnelCosts` P&L = bruts seuls
- `payrollTaxes` P&L = charges patronales (URSSAF + employer_rate)
- Cash = `personnel + payrollTaxes` (déjà le cas)

**Invariant testé** : `cf.personnel + cf.payrollTaxes (annuel) === pl.personnelCosts + pl.payrollTaxes`.

### Lot 2.5 — TVA mensuelle + régime
Calcul TVA par mois (collectée − déductible − TVA immo), respect du régime (`vat_regime` mensuel/trimestriel/simplifié) avec décalage de paiement réel. Dette TVA au bilan = solde non payé. Cash flow = paiements réels selon régime.
**Invariant testé** : `Σ cf.vatPayments year = Σ pl.vatDue year ± dette TVA fin d'année`.

### Lot 2.6 — BFR en TTC, P&L en HT
Créances clients = `CA TTC × delai / 360`. Dettes fournisseurs = `(achats + charges externes) TTC × delai / 360`. Stocks = `achats consommés × jours_stock / 360`. Ajouter input `inventory_days` (default 0). P&L reste en HT strict.
**Invariant testé** : créances/dettes affichées en TTC explicite, P&L en HT.

### Lot 2.7 — Cohérence régime fiscal IR vs IS
Si `tax_regime === 'IR'` : `corporateTax = 0` partout (P&L, cash, bilan). Mention explicite "Fiscalité personnelle hors périmètre". Si IS : calcul actuel. Le régime affiché dans le PDF doit être strictement celui utilisé.
**Invariant testé** : `tax_regime affiché === tax_regime utilisé pour le calcul`.

### Lot 2.8 — Mapping PCG par revenue_type
Routage automatique :
- `merchandise` → ventes 707, achats 607
- `production` → production vendue 701/704/705
- `services` → prestations 706
- `subscription` → 706 (par défaut, configurable)

Plus de hardcode "tout en 706". Migration data : ajouter UI pour reclasser les streams existants (Cloud Vapor : 706 → 707).
**Invariant testé** : chaque stream produit la bonne ligne PCG selon son type.

### Lot 2.9 — Scénarios appliqués en amont
Refactorer `useScenarioOverrides` pour appliquer les overrides **sur les inputs normalisés** avant `computeBPModel`, pas dans chaque hook. Garantit qu'un scénario modifie tous les états en cohérence.
**Invariant testé** : un scénario appliqué change P&L, cash, bilan de manière cohérente (même delta).

## PR 3 — Validateur (mise à jour des invariants)

8 règles bloquantes, alignées sur l'audit comptable :

```text
1. assets[i] === liabilities[i]                     (BS_BALANCED)
2. bs.cash[i] === cf.balance[lastMonth(i)]          (BS_CASH_MISMATCH)
3. fundingPlan.cash[i] === bs.cash[i]               (FP_CASH_MISMATCH)
4. debtVar = newDebt − principalRepaid              (LOAN_RECONCILIATION)
5. Σ charges par nature = pl.operatingExpenses      (CHARGES_NATURE_SUM)
6. cf.personnel + cf.payrollTaxes = pl personnel    (PERSONNEL_RECONCILIATION)
7. tax_regime displayed === tax_regime used         (TAX_REGIME_COHERENCE)
8. equity[i] − equity[i-1] === netResult[i] + apports
                                                    (PL_NET_RESULT_TO_EQUITY)
```

Sortie : `model.validation: ValidationReport` avec `code`, `severity`, `delta`, `tolerance`. Affiché en annexe PDF (PR 4) avec badge réconciliation en page de garde.

## PR 4 — PDF (rappel, plan déjà fait)

Page de garde + badge réconciliation, synthèse exécutive, P&L PCG avec codes visibles + % CA + SIG, bilan avec mention "trésorerie issue du cash flow", cash flow annuel normé, 5 annexes (hypothèses, échéancier emprunts, personnel détaillé, investissements, rapport de réconciliation).

## Ordre d'exécution

```text
2.0 normalizeRate audit          (préalable, 1 jour)
2.1 BS cash from CF              (réconciliation immédiate)
2.3 Loan schedule unique         (corrige plan de financement)
2.4 Personnel double-count       (corrige masse salariale)
2.7 Tax regime IR/IS             (corrige incohérence visible)
2.2 Charges variables strict     (corrige double-comptage)
2.5 TVA mensuelle                (corrige cash décaissements)
2.6 BFR en TTC                   (corrige BFR)
2.8 Mapping PCG par revenue_type (corrige Cloud Vapor 707 vs 706)
2.9 Scenarios upstream           (cohérence scénarios)
PR 3 Validateur                  (fige tout)
PR 4 PDF                         (livrable banquier)
```

Chaque lot = 1 commit, 1 test fixé contre Cloud Vapor, 1 delta chiffré documenté avant le suivant.

## Détails techniques

- Tous les modules `compute*` restent purs (pas de React, pas de Supabase). Les hooks `useBPModel` agrègent les inputs, les modules calculent, les sélecteurs exposent.
- `BPFinancialModel` étendu : `monthly.{pl,cashflow,balanceSheet,funding,vat,debtSchedule}`, `yearly.*`, `validation`, `engineVersion`.
- `buildLoanSchedule` placé dans `engine/schedules/loanSchedule.ts`, testé isolément.
- `normalizeRate` reste dans `src/lib/rateUtils.ts`, audit codebase via `rg` pour éliminer toutes les lectures brutes.
- Migration data Cloud Vapor (revenue_type 706 → 707) = script SQL ponctuel, hors code applicatif.
- Aucun changement UI dans PR 2 (hooks gardent leur signature publique grâce à PR 1).

## Hors périmètre

- Export Excel/Word (autre PR)
- Personnalisation visuelle PDF (logo, couleurs entreprise) — PR 4 livre la version "neutre banquier"
- Connecteurs externes (DGFiP, etc.)
- Multi-devise

## Validation finale

Quand toutes les PR sont passées :
- Tests Cloud Vapor : 8 invariants verts
- PDF Cloud Vapor : badge "États réconciliés", annexe rapport vide
- Revue manuelle CTO + comptable : feedback intégré ou écarts résiduels documentés

## Question

Tu veux qu'on attaque dans cet ordre, ou tu préfères :
- **Option A** : suivre l'ordre proposé (impact visible immédiat dès lot 2.1)
- **Option B** : commencer par PR 3 (validateur) en parallèle pour rendre les écarts chiffrés visibles avant tout fix — c'est ce que ton CTO appelait "PR 0 : prouver noir sur blanc avant de centraliser"
