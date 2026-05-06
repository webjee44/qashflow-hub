# Refacto BP engine — plan révisé v2

Plan révisé après retour comptable. Trois changements majeurs :
1. **PR0 obligatoire** (harness + audit + serializer) avant tout refacto.
2. **Une PR par lot** (plus de bundle PR1+PR2+PR3).
3. **Source de vérité = `engine/computeBPModel`**, pas `features/hooks/`. Les hooks divergents sont diff-és **manuellement**, pas remplacés par défaut.

Note vérifiée : une société = un seul BP (mémoire `business-plan/company-centric-architecture`), donc le scoping `company_id` dans `useBPModel` est correct par construction. Sera reverrouillé par contrainte DB en PR0.

---

## PR0 — Harness de non-régression (BLOQUANT)

Sans ce lot, tout refacto est aveugle. Aucun lot suivant ne démarre tant que PR0 n'est pas mergé.

### Livrables

**1. Sérialiseur déterministe**
- `engine/__tests__/serializeBPModel.ts` :
  - Exclut `getBreakEvenData` (fonction).
  - Convertit toutes les `Date` en `YYYY-MM-DD`.
  - Exclut `engineVersion` (bruit).
  - Tri stable des clés.
  - Arrondi à 2 décimales (évite jitter floating-point).
- Tests unitaires sur le sérialiseur lui-même.

**2. Golden snapshots**
- 2 fixtures réelles minimum :
  - `__fixtures__/cloud-vapor.json` (existe déjà).
  - `__fixtures__/minimal-bp.json` à créer (BP simple, 1 stream, 1 emprunt, 1 invest).
- Test `engine/__tests__/computeBPModel.golden.test.ts` qui charge chaque fixture, calcule le modèle, sérialise, compare au JSON figé.
- Mise à jour : `vitest -u` régénère les snapshots (volontaire).

**3. Tests d'exactitude comptable (différents des goldens)**
- `engine/__tests__/accounting.invariants.test.ts` :
  - Cas synthétique : CA HT 1M€, COGS 600k, salaires 100k bruts + 45% patronales, autres 50k, emprunt 120k/60mois/4%, invest 60k amorti 5 ans.
  - Vérifie : `Σ pl.netResult → equity`, `Σ intérêts P&L === Σ intérêts CF`, `Δ debt === nouveaux − remboursements`, `BS balanced`, `cash CF === cash BS`.
- Ces tests **doivent rester verts à travers tous les refactors**, contrairement aux goldens qui peuvent évoluer si on corrige un bug métier (auquel cas on documente l'écart et on régénère).

**4. Audit d'imports**
- Script `scripts/audit-bp-imports.ts` (one-shot) qui liste :
  - Tous les fichiers important `@/hooks/useBP*` vs `@/features/business-plan/hooks/...`.
  - Pour chaque hook dupliqué : un diff résumé (lignes, fonctions exportées, signatures).
- Sortie : `docs/bp-imports-audit.md` commit dans le repo. Sert de base à PR1.

**5. Contrainte DB single-BP**
- Migration : `CREATE UNIQUE INDEX business_plans_company_id_unique ON business_plans(company_id);` si pas déjà en place.
- Verrouille par construction l'invariant "1 société = 1 BP" et neutralise tout risque de mix par `company_id`.

**Critères de sortie PR0** : goldens + invariants comptables verts, audit publié, contrainte DB en place.

---

## PR1 — Déduplication des hooks (Lot A révisé)

**Changement vs v1** : la source de vérité **n'est pas** `features/hooks/` par défaut. Pour chaque hook divergent, on choisit explicitement la version la plus **complète et correcte**, pas la plus récemment déplacée.

### Méthode hook par hook

Pour chaque paire `src/hooks/useBPX.ts` vs `src/features/business-plan/hooks/useBPX.ts` :

1. Diff exhaustif (déjà fait dans audit PR0).
2. **Décision documentée** dans `docs/bp-hook-consolidation.md` :
   - Quelle version garder ?
   - Quelles fonctions/champs manquent dans l'autre ?
   - Y a-t-il une régression masquée si on garde la version "features" plus simple ?
3. Cible long terme : tous les hooks deviennent **sélecteurs** sur `useBPModel()`. Exemple `useProfitLoss` (déjà fait) :
   ```ts
   export function useProfitLoss() {
     const { data, isLoading } = useBPModel();
     return { data: data?.pl ?? EMPTY_PL, isLoading };
   }
   ```
4. Pour les hooks qui contiennent encore de la logique métier (ex. `src/hooks/useBPCashFlow.ts` 463 lignes vs 141 lignes côté features) :
   - Identifier ce qui est déjà couvert par `model.cashFlow`.
   - Migrer le reste dans le moteur ou justifier qu'il s'agit d'un calcul UI-only (KPI dérivé).
   - **Ne pas** supprimer la version riche au profit de la version pauvre.

### Livraison

- Re-exports temporaires dans `src/hooks/useBP*.ts` pour compat zéro casse.
- Migration des consommateurs (~70 imports) en un seul commit séparé.
- Suppression des re-exports.
- **Goldens + invariants doivent rester verts à chaque étape.**

**Effort réel** : 3-4h (pas 1h). **Risque** : moyen, mitigé par PR0.

---

## PR2 — Helpers de période partagés (Lot B révisé)

**Changement vs v1** : ce n'est PAS sans risque. Les bornes de date sont une source connue d'écarts.

### Actions

1. Créer `engine/_shared/period.ts` :
   - `isActiveInMonth(startDate, endDate, currentMonth)` — bornes inclusives explicites.
   - `buildFiscalYears(bpStart, fiscalYearStartMonth, durationMonths)`.
   - `monthsBetween(a, b)`.
2. **Avant migration** : tests unitaires exhaustifs sur ces helpers (mois début, mois fin, dates nulles, cross-year, fiscal start = juillet).
3. Migrer `computePL`, `computeCashFlow`, `computeBalanceSheet` un fichier à la fois, **avec golden tests entre chaque migration**.
4. Si un golden bouge : stop, diff la cause, décider si bug ancien (régénérer + documenter) ou bug introduit (rollback).

**Effort** : 1h30. **Risque** : faible si goldens en place, élevé sans.

---

## PR3 — Indexation Map + ladder croissance (Lot C révisé)

### Corrections vs v1

**1. Préserver la sémantique `.find()` (premier match)** :
```ts
const forecastByKey = new Map<string, number>();
for (const f of forecasts) {
  const key = `${f.stream_id}:${ymKey(f.month)}`;
  if (!forecastByKey.has(key)) forecastByKey.set(key, Number(f.amount));
}
```

**2. Ladder avec fallback correct sur `stream.growth_rate`** :
```ts
const ladder = [s.growth_rate_year2, s.growth_rate_year3, s.growth_rate_year4];
const specific = ladder[Math.min(yearOffset - 1, 2)];
const rate = (specific ?? s.growth_rate ?? 0);
```

**3. Hors scope (à lister, pas à corriger ici)** :
- Bug métier : `if (forecast?.amount)` ignore les forecasts à 0. À traiter dans PR métier dédiée.

### Livraison

- Bench `console.time('computeBPModel')` avant/après sur Cloud Vapor.
- Goldens stricts verts.

**Effort** : 45 min. **Risque** : faible avec les correctifs ci-dessus.

---

## PR4 — Couche `normalizeBPInput()` + typage (Lot D révisé)

**Changement vs v1** : on **ne supprime pas** les `Number(x) || 0` du moteur. On les **déplace** dans une frontière unique.

### Architecture

```text
DB raw rows  ──►  normalizeBPInput()  ──►  BPModelInput typé strict  ──►  computeBPModel()
                  (Number, defaults,         (no any, no defensive       (pure, typesafe)
                   coercion, dates)           coercion)
```

### Actions

1. Créer `engine/normalizeBPInput.ts` qui prend les rows Supabase brutes et retourne `BPModelInput` propre.
2. Définir les types stricts dans `engine/types.ts` (importés depuis hooks ou redéfinis).
3. Modifier `useBPModel` pour appeler `normalizeBPInput(rawRows)` avant `computeBPModel`.
4. Supprimer les `Number(x) || 0` UNIQUEMENT à l'intérieur du moteur, pas à la frontière.
5. Tests unitaires sur `normalizeBPInput` : nulls, strings, undefined, dates malformées.

**Effort** : 2h. **Risque** : moyen, gardé sous contrôle par les goldens et le test sur le normaliseur.

---

## PR5 — Split `computePL` + injection schedules (Lot E)

Inchangé sur le fond. Voir plan v1. Goldens obligatoires (déjà en place depuis PR0).

**Effort** : 1h30.

---

## PR6 — Split `BPDocument.tsx` (Lot F)

Secondaire. À planifier après stabilisation du moteur. Voir plan v1.

---

## PR7+ — Corrections métier (HORS refacto)

À traiter en PRs séparées, **après** stabilisation du moteur. Chaque correction casse volontairement les goldens — on les régénère et on documente.

### Bugs à instruire

1. **`purchase_price` ambigu** :
   - Stocké/affiché comme prix unitaire HT (`Unit purchase price HT`).
   - Utilisé dans `computePL` comme **pourcentage du CA** : `purchaseCost = revenue * (purchase_price / 100)`.
   - Décision produit nécessaire : Option A (prix unitaire × unités) ou Option B (renommer en `purchase_cost_rate` et garder le %).
   - Migration data si Option A.

2. **Forecast à zéro ignoré** :
   - `if (forecast?.amount)` traite 0 comme falsy → fallback sur `monthly_price`.
   - Correction : `if (forecast && forecast.amount != null)`.
   - Impact : permet activité saisonnière, fermetures, transitions.

3. **Variation de stock douteuse** :
   - Formule actuelle : `initial_stock + purchase_amount - final_stock`.
   - Si achats déjà comptés en 607/601, double comptage.
   - Audit comptable nécessaire avant correction.

4. **Tax regime sensible à la casse** :
   - `bp_settings.tax_regime = 'is'` mais comparaison `=== 'IS'` ailleurs.
   - Normaliser via `normalizeBPInput` (`.toUpperCase()`).

5. **Réconciliation cashflow vs P&L** :
   - Écarts mesurés en PR0 sur Cloud Vapor (~1,3 M€ d'outflows manquants).
   - Doit converger après PR4+PR5 ; sinon investigation dédiée.

---

## Séquencement

```text
PR0 (harness, BLOQUANT)
  ├─ serializer
  ├─ goldens (2 fixtures)
  ├─ invariants comptables
  ├─ audit imports
  └─ contrainte DB unique BP/société
        │
        ▼
PR1 (hooks, hook-par-hook avec décision documentée)  — 3-4h
        ▼
PR2 (period helpers, migration fichier-par-fichier)  — 1h30
        ▼
PR3 (Map + ladder, sémantique .find() préservée)     — 45 min
        ▼
PR4 (normalizeBPInput + typage)                       — 2h
        ▼
PR5 (split PL + schedules injectés)                   — 1h30
        ▼
PR6 (split BPDocument)                                — 30 min
        ▼
PR7+ (corrections métier, une par bug)
```

## Garde-fous transverses (non négociables)

- **Aucun lot ne merge si un golden ou un invariant comptable casse sans justification documentée.**
- Toute régénération de golden est accompagnée d'un commit séparé `chore(bp): regenerate goldens — <raison>`.
- Bench `computeBPModel` avant/après chaque PR (acceptable : ne se dégrade pas).
- Pas de `Number(x) || 0` ajouté hors `normalizeBPInput` après PR4.

## Hors scope confirmé

- Lots 2.2, 2.4, 2.5, 2.6, 2.9 du plan comptable PCG (data modeling).
- Migration React Query Suspense.
- Memoization globale.

## Recommandation

Démarrer **uniquement** par PR0. Sans le harness, PR1 est aveugle et le risque de régression silencieuse sur le cash-flow est réel (versions divergentes de `useBPCashFlow`).
