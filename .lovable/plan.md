# Séparation stricte BP / Trésorerie — plan v2 validé

## Décisions produit (verrouillées)

- **BP** = scénario prévisionnel pur. `computeCashFlow` reste inchangé, ne lit jamais les transactions.
- **Trésorerie** = moteur dédié, réel + prévi datés.
- **CTA** = copie one-shot auditée, jamais lien vivant.
- **Réel vs BP** = écran lecture seule.
- **Aucune logique métier partagée** entre BP et trésorerie. On partage uniquement des primitives techniques.

## Primitives partagées (et seulement celles-ci)

Nouvelle lib : `src/lib/finance/` (utilisable BP + trésorerie sans coupler les moteurs).

- `monthKey(date)` — `YYYY-MM`, normalisé Europe/Paris.
- `buildMonthRange(from, to)` — array de `Date` premier du mois, TZ Paris.
- `isSameOrBeforeDay(a, b)` — comparaison à la journée, TZ Paris.
- `normalizeAmount(raw)` — montant absolu positif, jamais signé.
- `isInternalTransfer(tx)` — détection virement interne (réutilise la logique actuelle déjà neutralisée ailleurs).
- `isActiveBridgeAccount(account)` — wrapper sur `company_active_bridge_accounts` (mémoire `bridge-accounts-two-level-model`).

Pas de buckets, pas de mapping P&L, pas de moteur ici. Pures fonctions.

## Ordre de livraison (PR par PR)

### PR1 — Types + helpers + `getTreasuryActuals`

**Nouveaux fichiers :**
- `src/lib/finance/monthKey.ts`, `buildMonthRange.ts`, `isSameOrBeforeDay.ts`, `normalizeAmount.ts`, `isInternalTransfer.ts`, `isActiveBridgeAccount.ts` (+ tests unitaires).
- `src/features/treasury/types/treasuryActuals.ts` :

```ts
export type CashFlowBucket =
  | 'revenue'
  | 'other_inflow'
  | 'fixed_expenses'
  | 'variable_expenses'
  | 'personnel'
  | 'payroll_taxes'
  | 'investments'
  | 'loan_payments'
  | 'vat_payments'
  | 'tax_payments'
  | 'uncategorized_inflow'
  | 'uncategorized_outflow';

export interface TreasuryActualLine {
  bucket: CashFlowBucket;
  amount: number;          // signé : >0 inflow, <0 outflow
  transactionIds: string[];
}

export interface TreasuryActualMonth {
  month: Date;             // 1er du mois Europe/Paris
  lines: TreasuryActualLine[];
  totalInflows: number;
  totalOutflows: number;
  net: number;
}
```

- `src/features/treasury/api/treasuryActualsApi.ts` :

```ts
getTreasuryActuals(params: {
  companyId: string;
  fromDate: string;        // ISO 'YYYY-MM-DD'
  toDate:   string;
}): Promise<TreasuryActualTransaction[]>
```

Filtres obligatoires (un seul round-trip + pagination > 1000) :
- `company_id = :companyId`
- `deleted_at IS NULL`
- `is_ignored = false`
- `date BETWEEN :fromDate AND :toDate`
- Jointure `company_active_bridge_accounts` pour exclure les comptes non actifs (transactions manuelles `bridge_account_id IS NULL` conservées).
- Jointure `categories` pour récupérer `cash_flow_bucket` (nullable) en une requête.
- Virements internes marqués (champ dérivé), pas filtrés ici — c'est `buildTreasuryActuals` qui décide.

Hook : `useTreasuryActuals(fromDate, toDate)` React Query, clé `['treasury-actuals', companyId, fromDate, toDate]`.

Tests : pagination > 1000, `is_ignored` exclus, période, comptes exclus, transactions manuelles conservées.

### PR2 — `buildTreasuryActuals` + `computeTreasuryPlan`

**`src/features/treasury/engine/buildTreasuryActuals.ts`** (pur) :
- Input : `transactions[]` (sortie PR1) + `asOfDate`.
- Skip virements internes.
- Classement par `categories.cash_flow_bucket` :
  - bucket défini → utilisé tel quel.
  - bucket `NULL` ET `type=income` → `uncategorized_inflow`.
  - bucket `NULL` ET `type=expense` → `uncategorized_outflow`.
- Agrégation par `(month, bucket)` → `TreasuryActualLine[]`.
- Calcul `totalInflows / totalOutflows / net` par mois.

**`src/features/treasury/engine/computeTreasuryPlan.ts`** :
- Input :
  - `actuals: TreasuryActualMonth[]`
  - `forecasts: TreasuryForecastEntry[]` (lignes prévi trésorerie existantes, avec leur `date` précise)
  - `asOfDate: Date`, `openingBalance: number`, `openingDate: Date`
- Règle par mois M :
  - `endOfMonth(M) < startOfDay(asOfDate)` → **actuals seuls**, `source='actual'`.
  - `startOfMonth(M) > startOfDay(asOfDate)` → **forecasts seuls**, `source='forecast'`.
  - Sinon (mois courant) → **actuals à date + forecasts dont `date > asOfDate`**, `source='blended'`. **Pas de prorata.**
- Toutes les comparaisons via `isSameOrBeforeDay` en Europe/Paris.
- Invariant `Opening + Σ Net = Closing` garanti, vérifié par test.

Tests : passé pur, futur pur, mois courant blend (cas asOfDate=15, forecasts datés 10, 20, 25 → seuls 20 et 25 retenus), invariant balance, cas Cloud Vapor avril 2026.

### PR3 — `categories.cash_flow_bucket` + UI

**Migration :**
```sql
CREATE TYPE cash_flow_bucket AS ENUM (
  'revenue','other_inflow','fixed_expenses','variable_expenses',
  'personnel','payroll_taxes','investments','loan_payments',
  'vat_payments','tax_payments'
  -- 'uncategorized_*' jamais stockés, déduits côté engine
);
ALTER TABLE categories ADD COLUMN cash_flow_bucket cash_flow_bucket;
ALTER TABLE categories ADD COLUMN cash_flow_bucket_confidence text
  CHECK (cash_flow_bucket_confidence IN ('system','suggested',NULL));
```

- Reste **nullable**. Aucun backfill heuristique agressif.
- Backfill uniquement pour : catégories **système** (`is_system=true`) au mapping évident (ex. système "TVA collectée/déductible" → `vat_payments`, "Salaires" → `personnel`, etc.) → `confidence='system'`.
- Autres : laissées `NULL`. UI proposera un bucket suggéré non validé.

**UI :**
- `CategoryDialog` : select `cash_flow_bucket` + badge "Système" / "Suggéré" / "À définir".
- Aucun impact BP.

### PR4 — CTA import BP avec audit + rollback

**Migration :**
```sql
CREATE TABLE treasury_forecast_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  business_plan_id uuid,
  source text NOT NULL DEFAULT 'bp_revenue',
  include_current_month boolean NOT NULL DEFAULT false,
  as_of_date date NOT NULL,
  months_affected int NOT NULL,
  total_amount numeric NOT NULL,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE forecast_entries  -- ou table équivalente des forecasts trésorerie
  ADD COLUMN origin text,                       -- 'bp_import' | NULL
  ADD COLUMN origin_business_plan_id uuid,
  ADD COLUMN origin_stream_id uuid,
  ADD COLUMN origin_import_run_id uuid REFERENCES treasury_forecast_import_runs(id);

-- Garantie API : pas de modif des mois passés
CREATE OR REPLACE FUNCTION enforce_no_past_forecast_write() RETURNS trigger ...
-- INSERT/UPDATE/DELETE refusé si entry.month < current_month_start(Europe/Paris)
-- ET origin='bp_import' (l'utilisateur garde la main sur ses propres lignes)
```

**Edge Function `import-bp-revenue-to-treasury`** (verify_jwt=false, auth via `getUser`) :
1. Charge `bp_revenue_forecasts` du company → agrégat mensuel.
2. Détermine `asOfDate` (now, Europe/Paris), `include_current_month` depuis le payload.
3. Filtre mois éligibles : `month > asOfDate` (et inclut mois courant si demandé).
4. Crée la ligne `treasury_forecast_import_runs`.
5. **UPSERT** des forecasts par `(company_id, month, stream_id, origin='bp_import')` — idempotent, jamais de duplicat.
6. Aucun écrit sur mois passé (trigger garantit).
7. Retourne run_id + résumé.

**Endpoint rollback** : marque `rolled_back_at` + supprime les forecasts liés au `import_run_id` (uniquement futurs, jamais passés).

**UI Forecasts.tsx :**
- Bouton "Importer le CA du BP".
- Dialog : checkbox "Inclure le mois courant" (décochée par défaut), résumé mois/montants, bouton confirmer.
- Bandeau sur les forecasts importés : `Importé depuis BP le {date}. Non synchronisé automatiquement. Réimporter pour actualiser.` + bouton "Annuler ce import" (rollback du run).
- Historique des runs dans un panneau pliable.

### PR5 — Page "Réel vs BP" (lecture seule)

- Route `BusinessPlan/RealVsForecast.tsx`.
- Lit indépendamment : `computeTreasuryPlan` (réel) + `computeCashFlow` BP (prévi).
- Tableau mensuel : CA réel / CA BP / écart / écart %. Idem charges principales.
- Aucun moteur partagé, aucun upsert.

## Hors scope

- Refonte de `useForecasts` (PR ultérieur si besoin).
- Saisonnalité du split mensuel dans `bp_revenue_forecasts` côté P&L BP (sujet indépendant).
- Lien vivant BP ↔ Trésorerie : explicitement refusé.

## Garde-fous transversaux

- Toutes les dates : Europe/Paris, comparaison à la journée.
- `cash_flow_bucket` nullable, jamais inféré côté BP.
- Mois passés jamais modifiés par l'import — **garanti par trigger DB**, pas par le front.
- Aucun `supabase.from()` direct depuis les composants : tout passe par les API features.
- Tests Vitest pour chaque pure function ; tests Deno pour l'edge function.
