## Objectif

Rendre l'export Excel du BP exploitable par un comptable, **sans jamais
forcer artificiellement l'équilibre du modèle**. La méthode est inversée :
on écrit d'abord les tests qui doivent rester rouges, puis on corrige le
moteur, puis l'export.

## Principes non négociables

1. **Aucune écriture silencieuse d'équilibrage.** Le bilan ne se "rattrape"
   jamais avec un capital social fictif ou une trésorerie d'ouverture
   inventée. Toute valeur d'ouverture vient soit d'une hypothèse explicite
   saisie, soit d'une ligne dédiée `Situation nette initiale (report à
   nouveau non détaillé)` clairement libellée.
2. **Statut vert = fixture propre uniquement.** Un BP réel incomplet doit
   produire des erreurs/warnings explicables, pas un faux vert obtenu par
   patch.
3. **Arrondis uniquement à la frontière export Excel.** Le moteur reste en
   double précision intégrale ; `roundEuro` vit dans `export/excel`, jamais
   dans `engine/`.
4. **`monthlyRows` est la source de vérité du P&L.** Les agrégats annuels
   sont des sommes pures de `monthlyRows`, pas des recalculs parallèles.
5. **Taux normalisés via une fonction unique.** `normalizeRate(value)`
   gère le `45` → `0.45` et le `0.45` → `0.45` au même endroit, et est
   utilisée partout (charges patronales, TVA, croissance, intérêts).

## PR 0 — Tests rouges (à livrer avant tout changement moteur)

Aucune modification de logique métier. Uniquement des tests Vitest qui
doivent **échouer** sur le code actuel et serviront de filet pour les PR
suivantes. Fixtures dans `engine/__tests__/fixtures/`.

### Fixtures

- `clean-ecommerce.ts` : BP minimal cohérent (capital saisi, stock saisi,
  un emprunt, charges fixes/variables, 1 salarié à 35 % patronal). C'est
  la fixture qui doit passer **verte** à la fin.
- `efumeur-snapshot.ts` : snapshot anonymisé du BP réel `E-fumeur Internet`
  pour caractériser les erreurs attendues sans les masquer.

### Suites

| Fichier | Invariant testé |
|---|---|
| `computeBalanceSheet.balance.test.ts` | `Math.abs(totalAssets[i] − totalLiabilities[i]) < 1` sur fixture propre |
| `engine.reconciliation.test.ts` | `cashFlow.balance[lastMonth(i)] === balanceSheet.cash[i] === fundingPlan.cumulativeBalance[i]` |
| `payrollTaxes.rate.test.ts` | Salaire brut 3 000 €, taux 45 % → P&L charges sociales = 1 350 € le mois M ; cash-flow charges sociales = 1 350 € le mois M+1 |
| `stockVariation.sign.test.ts` | Stock initial 100, achats 500, stock final 150 → `merchandisePurchases = 500`, `stockVariation = +50` (augmentation actif), `consommé = 450` |
| `pl.monthlyRows.test.ts` | `pl.monthlyRows.length > 0`, longueurs égales à `pl.years.flatMap(y => y.months).length`, agrégat manuel ≈ `pl.totals` |
| `assumptionsExport.mapping.test.ts` | Pour chaque entrée DB non nulle (`monthly_amount`, `gross_salary`, `employer_charges_rate`, `initial_stock`), la cellule Excel correspondante n'est pas 0 |
| `roundingBoundary.test.ts` | Le moteur conserve les flottants exacts ; seules les cellules Excel sont arrondies (test sur `buildBPWorkbook` vs `computeBPModel`) |

Ces tests seront committés **rouges**, avec un `it.fails(...)` ou un
commentaire `// EXPECTED RED — fixed in PR-N` selon le cas, pour rendre
visible la dette à payer.

## PR 1 — Helpers transverses

1. `engine/utils/normalizeRate.ts` : convertit indifféremment `45`, `0.45`,
   `"45%"` en `0.45`. Couvre 0, NaN, valeurs négatives. Tests unitaires.
2. Remplacement progressif (sans changer la logique) des lectures directes
   de `employer_charges_rate`, `vat_rate`, `interest_rate`, `growth_rate*`,
   `churn_rate` par `normalizeRate(...)`. Une seule PR ciblée pour
   verrouiller l'usage.

## PR 2 — Ouverture comptable explicite

Travail dans `computeBalanceSheet.ts`, `computeFundingPlan.ts`, types.

1. Lecture des **vraies hypothèses d'ouverture** :
   - Capital social = `bp_settings.initial_capital` (à introduire si absent ;
     migration sans valeur par défaut, nullable).
   - Trésorerie d'ouverture = `bp_settings.initial_cash` **uniquement si
     contrepartie connue** (apport en capital ou compte courant associé).
2. Si l'utilisateur a saisi une trésorerie d'ouverture sans contrepartie,
   on la pose à l'actif **et** on inscrit la différence dans une ligne
   passive intitulée `Situation nette initiale (report à nouveau non
   détaillé)`. Cette ligne est typée `header`-like avec un libellé
   non-ambigu et apparaît telle quelle dans l'export.
3. Aucune écriture automatique cachée. Si rien n'est saisi, le bilan part
   de 0 et le contrôle `BS_BALANCED` peut être KO — c'est attendu et
   visible.

## PR 3 — Variation de stock cohérente

`computePL.ts` + `computeBalanceSheet.ts`.

- Convention PCG retenue (validée par le test `stockVariation.sign.test.ts`) :
  - `merchandisePurchases[i] = sum(achats N)`
  - `stockVariation[i] = stockFinal[i] − stockInitial[i]` (positif si stock
    augmente)
  - `coutDesAchatsConsommes[i] = merchandisePurchases[i] − stockVariation[i]`
- L'actif `Stocks` du bilan = `stockFinal[i]`, sans recalcul parallèle.
- Documentation inline + exemple chiffré 100 / 500 / 150 → 450.

## PR 4 — Charges patronales propres

`computeCashFlow.ts` + `computePL.ts`.

- `payrollTaxes_PL[mois M]   = gross_salary × normalizeRate(employer_charges_rate)`
- `payrollTaxes_cash[mois M+1] = payrollTaxes_PL[mois M]`
  - Décalage paramétrable plus tard, mais **distinct de la TVA** : pas de
    code partagé, pas de mutualisation accidentelle. Helper dédié
    `shiftMonthlySeries(series, 1)`.
- Décompte de fin de période géré comme pour la TVA mais via le helper,
  sans réutiliser la branche TVA.

## PR 5 — Plan de financement réconcilié

`computeFundingPlan.ts`.

- `cumulativeBalance` initialisé à `cashFlow.initialBalance` (= ce qui est
  réellement saisi en hypothèse, pas une valeur dérivée).
- Invariant testé : `cumulativeBalance[i] === cashFlow.balance[lastMonth(i)]`.
- Si écart > 1 €, le contrôle `FP_CASH_VARIATION_MATCH` reste KO ; on ne
  patche pas la valeur affichée.

## PR 6 — `monthlyRows` source unique du P&L

`computePL.ts`.

- Construire `pl.monthlyRows: PLRow[]` (mêmes labels, mêmes types et
  indents que les rows annuelles) pour l'ensemble des postes.
- Refactorer `pl.totals.<metric>[i]` pour qu'il soit la somme stricte de
  `monthlyRows` filtrées sur l'année `i`. Une seule passe de calcul.
- L'export `plMonthly.ts` consomme `pl.monthlyRows`, l'export `plYearly.ts`
  consomme l'agrégat dérivé.

## PR 7 — Hypothèses Excel honnêtes

`excel/sheets/assumptions.ts`.

- Mappings DB-réels (`monthly_amount`, `employer_charges_rate`, `initial_stock`,
  `purchase_amount`, `final_stock`, `worker_type`, `daily_rate`, etc.).
- Pour chaque taux affiché : **deux colonnes** côte à côte
  - "Valeur saisie (DB brute)"
  - "Valeur utilisée par le moteur (normalizeRate)"
  Le comptable voit immédiatement si `45` a été lu comme `45 %` ou `4500 %`.
- Une section récapitulative par catégorie indique le total annualisé tel
  qu'envoyé au moteur, pour comparaison visuelle au P&L.

## PR 8 — Onglet Synthèse + Contrôles

`excel/sheets/synthesis.ts` (nouveau) + amélioration de `controls.ts`.

- **Synthèse** : KPI Y1/Y2/Y3 (CA, marge brute, EBE, RN, trésorerie fin
  d'année, BFR, dette financière), plus matrice "Statut des contrôles" par
  code. Statut affiché tel quel : un BP incomplet montre des KO, ce qui est
  l'objectif.
- **Contrôles** : tri par sévérité descendante, écart formaté en €, message
  rendu actionnable.

## PR 9 — Frontière de formatage

`excel/styles.ts` + orchestrateur `buildBPWorkbook.ts`.

- Helper `roundEuro(v) = Math.round(v)` et `roundCent(v) = Math.round(v*100)/100`,
  appliqués **uniquement** au moment d'écrire les cellules Excel.
- Le moteur n'importe pas ces helpers. Lint custom ou simple test
  d'imports croisés (`engine/` ne référence rien dans `export/excel/`).
- Formats : `#,##0 €;[Red](#,##0 €);"-"` partout pour les montants,
  `0.0%;[Red](0.0%);"-"` pour les taux, `#,##0.00 €` réservé aux prix
  unitaires.

## Critères d'acceptation

Sur la fixture `clean-ecommerce` :

- [ ] `BS_BALANCED`, `BS_CASH_MISMATCH`, `LOAN_RECONCILIATION`,
  `FP_CASH_VARIATION_MATCH`, `PERSONNEL_RECONCILIATION`,
  `CHARGES_NATURE_SUM`, `TAX_REGIME_COHERENCE` → tous OK.
- [ ] Onglet Synthèse vert.

Sur le BP réel `E-fumeur Internet` :

- [ ] Les erreurs restantes sont **explicables par des hypothèses
  manquantes** (capital social non saisi, trésorerie d'ouverture sans
  contrepartie, taux patronal absent). Aucune erreur ne doit provenir
  d'un bug moteur.
- [ ] Onglet "P&L mensuel" rempli sur 36 mois.
- [ ] Onglet "Hypothèses" : valeur DB brute et valeur normalisée visibles
  pour chaque taux ; aucun 0 € quand la DB porte une valeur.
- [ ] Aucune décimale parasite ni notation scientifique dans les cellules.

## Ordre d'exécution

1. **PR 0** — tests rouges (filet de sécurité, aucun risque de régression).
2. **PR 1** — `normalizeRate` + adoption.
3. **PR 2** — ouverture explicite, ligne `Situation nette initiale`.
4. **PR 3** — variation de stock.
5. **PR 4** — charges patronales.
6. **PR 5** — plan de financement.
7. **PR 6** — `monthlyRows` source unique.
8. **PR 7** — hypothèses Excel double colonne.
9. **PR 8** — Synthèse + Contrôles.
10. **PR 9** — frontière de formatage.

Chaque PR fait passer un sous-ensemble identifié des tests rouges de PR 0.
Aucune PR ne doit en désactiver un sans justification écrite dans le diff.

---

## État de livraison (2026-05-10)

- [x] **PR 0** — 16 tests rouges (filet de sécurité)
- [x] **PR 1** — `normalizeRate` adopté dans `computePL` (TVA, charges patronales, charges dirigeants)
- [x] **PR 2** — Migration `bp_settings.initial_capital`, ligne « Situation nette initiale » au passif
- [x] **PR 5** — `computeFundingPlan` utilise `initial_capital` (capital social) distinct de `initial_cash` (ligne dédiée « Trésorerie initiale (ouverture) »)
- [x] **PR 7** — Onglet Hypothèses expose taux DB brut + taux moteur normalisé pour personnel/dirigeants
- [x] **PR 8** — Nouvel onglet **Synthèse** (KPI annuels + matrice rouge/vert des contrôles d'intégrité)
- [x] **PR 9** — Helper `roundEuro`/`roundCent` appliqué à la frontière Excel (bilan, plan financement, P&L mensuel/annuel, cash-flow). Engine reste en flottants exacts.

**Restent à faire (engine, hors scope de ce passage)** :

- [ ] **PR 3** — Refondre `stockVariation` (signe PCG 603 = `initial − final`, séparé du « consommé »)
- [ ] **PR 4** — Décalage cash M+1 sur les charges patronales via `shiftMonthlySeries`
- [ ] **PR 6** — Faire de `pl.monthlyRows` la source unique de vérité du P&L annuel (somme stricte, plus de calcul parallèle)

Ces 3 PR moteur restantes nécessitent un travail dédié sur `computePL`/`computeCashFlow` avec validation invariant par invariant. Les tests rouges PR 0 correspondants restent en `it.fails` jusqu'à leur livraison.
