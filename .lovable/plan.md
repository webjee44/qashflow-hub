
# Plan correctif Business Plan — version révisée (B + PR 0)

Choix retenu : **option B (PRs successives)** avec une **PR 0 de diagnostic** avant tout refactor. Objectif : prouver les écarts noir sur blanc et figer des tests rouges *avant* d'unifier le moteur, pour ne pas centraliser une logique fausse.

---

## PR 0 — Diagnostic reproductible Cloud Vapor (lecture seule)

**But** : produire un rapport factuel des écarts actuels et figer des invariants cassés en tests rouges. Aucun changement de comportement utilisateur.

Livrables :
1. `scripts/bp-diagnose.ts` (script Node exécutable en local, pas en prod) :
   - Charge tous les inputs BP de Cloud Vapor (`bp_revenue_streams`, `bp_variable_expenses`, `bp_fixed_expenses`, `bp_personnel`, `bp_directors`, `bp_investments`, `bp_financings`, `bp_settings`, `bp_stocks`, `bp_scenarios`, `bp_scenario_overrides`).
   - Sérialise un dump JSON anonymisé dans `src/features/business-plan/__fixtures__/cloud-vapor.json`.
2. `scripts/bp-reconciliation-report.ts` :
   - Exécute les hooks actuels (`useProfitLoss`, `useBPCashFlow`, `useBalanceSheet`, `useFundingPlan`) sur la fixture.
   - Génère un rapport markdown ligne par ligne : CA / COGS / Services / Charges fixes / Personnel / Dirigeants / Amortissements / Intérêts / Remb. capital / IS / BFR / TVA / Tréso finale (P&L, cash flow, bilan, plan financement) / Capital / Stocks.
   - Calcule les écarts entre états et les liste explicitement.
3. `src/features/business-plan/__tests__/invariants.cloud-vapor.test.ts` (tests rouges autorisés, marqués `.failing`) :
   - `treasury.cashflowEnd[y] === treasury.balanceSheetEnd[y]` (tolérance 1 €)
   - `treasury.fundingPlanEnd[y] === treasury.balanceSheetEnd[y]`
   - `Δ debt bilan == nouveaux emprunts − remboursements capital`
   - `personnel.detailTotal === pnl.personnelTotal`
   - `Σ charges page Charges === pnl.operatingExpenses`
   - `notes.taxRegime` cohérent avec `pnl.taxLine`
4. Rapport remis dans le PR : "voici ce qui est cassé, ligne par ligne, et voici les tests qui le prouvent".

**Pas de refactor. Pas de correctif. Juste la photo.**

---

## PR 1 — Moteur pur `computeBPModel` (parité comportementale)

Objectif : centraliser sans changer les résultats. À la fin de PR 1, les tests d'invariants restent rouges (sauf ceux qui étaient déjà OK), mais l'écran P&L et le PDF sortent **du même calcul**.

Contraintes non négociables :
- `computeBPModel(input: BPModelInput): BPFinancialModel` est une **fonction pure** : pas de React, pas de Supabase, pas de React Query, pas de `currentCompany`, aucun side-effect.
- **Granularité mensuelle d'abord**, agrégation annuelle ensuite : `model.months[]` puis `model.years[] = aggregate(model.months)`.
- Montants normalisés via une fonction centrale d'arrondi (`roundCents` ou intégers en centimes pour les invariants).
- Taux normalisés via la fonction unique `normalizeRate` (déjà créée en PR précédente, à étendre à tous les usages : croissance, churn, charges sociales, taux dirigeants, intérêts, TVA, % charges variables).
- Le PDF ne fait **plus aucun calcul** : il consomme `BPFinancialModel`.

Refactor :
- `useProfitLoss`, `useBPCashFlow`, `useBalanceSheet`, `useFundingPlan`, `useBPRatios` deviennent de simples sélecteurs sur `useBPModel()`.
- `useBPModel()` = unique hook React Query qui appelle `computeBPModel(input)`.
- `BPDocument` reçoit `BPFinancialModel`, plus aucun champ ad hoc.

À la fin de PR 1 : écran et PDF affichent les **mêmes chiffres** (même faux). Les écarts entre P&L / cash flow / bilan / financement persistent — on les corrige en PR 2.

---

## PR 2 — Corrections financières dans le moteur

Une correction = un commit isolé, chacun fait passer un ou plusieurs tests rouges au vert.

1. **Taux** : sweep complet `normalizeRate` sur tous les inputs du moteur. Tests dédiés.
2. **COGS vs services extérieurs vs charges variables** :
   - Règle stricte : une charge appartient à **une seule** famille (`cogs` | `external_services_variable` | `other_operating`).
   - Source unique : `bp_variable_expenses.category` + `pcg_subcategory`.
   - `bp_revenue_streams.has_purchase_cost` ne doit jamais coexister avec une `bp_variable_expenses` qui couvre le même flux (validateur → warning).
   - Test : `Σ charges par nature === pnl.operatingExpenses`.
3. **Emprunts** : table d'amortissement réelle (mensualité constante par défaut, linéaire en option).
   - Génère `{month, payment, interest, principal, remainingPrincipal}`.
   - P&L → `interest`. Cash flow → `interest + principal`. Bilan → `remainingPrincipal`.
   - Plan de financement → `principal` (remboursements) + nouveaux emprunts.
   - Test : `Δ debt bilan === nouveaux emprunts − Σ principal`.
4. **Cash flow connecté au P&L** :
   - Décaissements : achats/COGS (avec `supplier_payment_delay`), services, charges fixes, salaires + charges sociales + dirigeants + indemnités, TVA selon `vat_regime`, intérêts + capital, investissements à la date d'achat, IS selon échéancier.
   - Encaissements : CA TTC avec `customer_payment_delay`, financements reçus.
   - Test : `treasury.cashflowEnd === treasury.balanceSheetEnd`.
5. **Fiscalité** :
   - Si IS : calculer comme aujourd'hui (15 % jusqu'à 42 500 € si PME, puis 25 %).
   - Si IR : `pnl.tax = 0`, ligne libellée "Impôt société : 0 — fiscalité personnelle hors périmètre BP". Notes alignées.
   - Validateur : `notes.taxRegime` doit correspondre au calcul.
6. **Stocks** : pas d'auto-calcul. Si `stocks = 0` ET achats significatifs → warning + demande d'hypothèse (jours de rotation OU stock initial/final saisi). Pas d'invention.
7. **Capital social** : ajouter `bp_settings.share_capital` (nullable). Préremplissage depuis `companies` au démarrage du BP. Bilan affiche "Non renseigné" si null, jamais 0.
8. **Libellés PCG** : mapping `pcgLabels.ts` piloté par `bp_revenue_streams.revenue_type` (706/707) et `bp_variable_expenses.pcg_subcategory` (601/607/611/...).

---

## PR 3 — Validateur + UI contrôles

1. `validateModel(model: BPFinancialModel): ValidationIssue[]` (fonction pure).
2. Règles : tous les invariants de PR 0 + warnings métier (capital = 0, stocks suspects, régime mélangé, etc.) avec sévérité `info` / `warning` / `critical`.
3. UI : nouvelle section "Contrôles de cohérence" dans `/bp/*`, badge rouge si critical.
4. PDF : page "Contrôles" + bandeau "Document non finalisé — incohérences détectées" en couverture si critical présent.
5. Export : autorisé mais bloqué tant que critical actif, sauf opt-in explicite ("J'ai pris connaissance des incohérences").

---

## PR 4 — Refonte des pages PDF

Aucun nouveau calcul. Uniquement de la mise en forme propre du `BPFinancialModel`.

1. **P&L** strictement SIG (Marge commerciale → Marge brute → Valeur ajoutée → EBE → Résultat exploitation → RCAI → Résultat net), une ligne par poste PCG.
2. **Page Charges** renommée "Synthèse des charges par nature" : chaque charge une seule fois ; total = charges d'exploitation P&L.
3. **Page Personnel** : Salaires bruts / Charges patronales / Primes / Indemnités / Dirigeants brut / Charges dirigeants / **Total = ligne P&L**.
4. **Page Hypothèses détaillées** : drivers revenus (volumes, prix, croissance, churn), délais, TVA, régime fiscal, taux charges sociales, détail emprunts (capital/taux/durée/mensualité/CRD), détail investissements.
5. **Trésorerie initiale** : si `0`, message explicite ; option "importer le solde bancaire réel".
6. **Couverture** : capital social, forme juridique, SIRET si dispo.

---

## Tests (ajoutés au fil des PRs)

- `computeBPModel.test.ts` : cas synthétiques (CA pur, négoce, abonnements, mix).
- `invariants.cloud-vapor.test.ts` : tests rouges de PR 0 → progressivement verts au fil de PR 2.
- `validateModel.test.ts` : chaque règle déclenchée correctement.
- Snapshot léger texte du PDF Cloud Vapor (sécurise les libellés, pas la mise en page).

---

## Garde-fous transverses

- Aucun fix en dur, aucune valeur métier hardcodée.
- Aucune duplication de logique entre PDF / écran / tests.
- Toute valeur affichée provient de `BPFinancialModel`.
- Migration DB unique (PR 2 / point 7) : ajout `bp_settings.share_capital`.

---

## Démarrage

J'attaque par **PR 0 (diagnostic)** dès que tu valides ce plan : extraction fixture Cloud Vapor + rapport de réconciliation + tests rouges des invariants. Tu auras ensuite la photo exacte avant qu'on touche au moteur.
