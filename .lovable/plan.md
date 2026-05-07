
# Refonte "Safe Learning Automation" — v2 (intégration retours CTO)

## Vision produit

> Qashflow ne devine pas. Qashflow apprend, explique, applique seulement quand c'est sûr, et permet de rollback.

**Promesse commerciale Phase 1 :** *Vous pouvez activer les automatisations sans risque : vous voyez l'impact avant, vous avez l'historique après, vous pouvez annuler.*

## Principes non négociables

1. **Dry-run d'abord.** Toute règle est prévisualisée serveur avant création/édition. Le front ne calcule plus l'impact.
2. **Le LLM n'est jamais souverain.** LLM seul = `suggest` ou `review`. Auto-application seulement si règle validée + historique fort + score combiné.
3. **Aucune écrasement silencieux d'une décision humaine.** Par défaut, le runner ne touche que les transactions non catégorisées. `reclassify_existing=false` par défaut, mode explicite sinon.
4. **Tout est explicable et réversible.** Chaque action stocke `confidence`, `confidence_source`, `reason_codes`, `evidence` et appartient à un `automation_run` rollback-able.
5. **L'apprentissage prend en compte les signaux négatifs** (refus, corrections, désactivations, rollbacks), pas seulement les validations.
6. **Vocabulaire honnête.** Pas de mot `accuracy` : on parle de `stability_rate_30d`, `correction_rate`, `explicit_validation_rate`, `conflict_rate`.

---

## Ordre d'exécution révisé

| PR | Contenu | Phase | Valeur |
|----|---------|-------|--------|
| **PR1** | Dry-run serveur (`automation-rule-preview`) | 1 — Sécurisation | Confiance avant action |
| **PR2** | Audit log + rollback (`automation_runs`, `automation_run_items`) | 1 | Réversibilité |
| **PR3** | Priorité + conflits + `specificity_score` défini + stats réelles | 1 | Honnêteté + non-silence |
| **PR4** | Pattern scorer v1 (sans merchant_key) | 2 — Intelligence | Remplace "2 mots" naïfs |
| **PR5** | Normalizer + `merchant_key` + backfill safe versionné | 2 | Fondation merchant |
| **PR6** | Conditions enrichies + dépréciation `bank_account_name` | 2 | Règles robustes |
| **PR7** | `classify-transaction` contextuel (LLM en arbitrage borné) | 3 — IA utile | Suggestion intelligente |
| **PR8** | Review queue persistante (`transaction_category_suggestions`) + feedback events | 3 | Workflow réel des 20% |
| **PR9** | CRON `detect-automation-opportunities` (non destructif) | 4 — Apprentissage | Suggestions continues |
| **PR10** | Modes avancés + sensitive categories + reclassify_existing | 4 | Garde-fous finaux |

---

## Phase 1 — Sécurisation (PR1 → PR3)

### PR1 — Dry-run serveur

Nouvelle edge function `automation-rule-preview`.

Input : `{ conditions[], target_category_id, scope: { company_id }, mode_simulation?: 'apply'|'reclassify' }`

Output :
```
{
  matched_total: 47,
  matched_uncategorized: 23,
  matched_already_categorized: 24,
  same_category_count: 18,         // déjà classées dans la cible
  other_category_count: 6,         // classées ailleurs (signal de conflit historique)
  existing_categories_distribution: [{ category_id, count }],
  conflicts_with_other_rules: [{ rule_id, overlap_count }],
  total_amount_impact: 4812.45,
  safety_score: 0.82,
  warnings: ['sensitive_category', 'high_amount', 'pattern_too_short'],
  examples: [10 transactions]
}
```

Front (`SuggestAutomationDialog`, `CreateRuleDialog`, `EditRuleDialog`) :
- Suppression complète du calcul local sur `allTransactions`
- Affichage du panneau de preview standardisé
- Bouton "Créer la règle" désactivé si `safety_score < 0.6` sans confirmation explicite (checkbox "Je comprends les risques")

### PR2 — Audit log + rollback

Tables :
- `automation_runs` (id, rule_id NULL si run multi-règles, triggered_by, mode, total_matched, total_applied, total_skipped_conflict, started_at, finished_at, status, can_rollback bool, rolled_back_at)
- `automation_run_items` (id, run_id, transaction_id, previous_category_id, new_category_id, confidence, confidence_source, reason_codes jsonb, evidence jsonb, status, rolled_back_at)

Refactor :
- `apply-automation-rule` et `apply-all-automation-rules` créent toujours un run + items
- Nouvelle edge function `rollback-automation-run` : restaure les `previous_category_id`, marque `status='rolled_back'`, **émet un `automation_feedback_event`** (cf PR8)
- UI : section "Historique" sur la fiche règle avec liste runs + bouton Annuler

### PR3 — Priorité, conflits, stats réelles

Migrations sur `automation_rules` :
- `priority int default 100`
- `created_from text` (`manual`|`ai_suggestion`|`learned`)
- `validated_examples_count int`
- `false_positive_count int`
- `last_correction_at`
- `specificity_score numeric` (recalculé à chaque save)

**Définition explicite de `specificity_score`** (à coder dans `_shared/ruleScoring.ts`) :
```
+50  merchant_key exact
+20  bank_account_id / bridge_account_id
+15  amount_around / amount_between
+10  recurrence true
+5   day_of_month
+2   description contains (≥4 chars)
-20  description contains pattern court (<4 chars) ou trop générique
```

Runner : tri `(priority DESC, specificity_score DESC, created_at ASC)`. **Si delta de score < 5 entre 2 règles candidates → pas d'application, status `conflict` dans `automation_run_items`, surfacé UI.**

Stats réelles (suppression de `accuracy: 96` et `timeSaved: '12h'`) :
- `stability_rate_30d` = items non corrigés sous 30j / total appliqué (jamais appelé "accuracy")
- `correction_rate` = items corrigés / total appliqué
- `explicit_validation_rate` = items confirmés explicitement / total appliqué
- `conflict_rate` = runs avec conflit / total runs
- Par règle : `precision`, `false_positive_count`, `last_correction_at`
- `time_saved_estimate` = total appliqué × 8s (constante documentée)

---

## Phase 2 — Intelligence locale (PR4 → PR6)

### PR4 — Pattern scorer v1 (sans merchant_key)

Edge function `score-rule-patterns`. Génère N candidats à partir du libellé normalisé : n-grams (2-4 tokens), préfixes, tokens distinctifs (≥4 chars, hors stopwords bancaires), combinaisons texte+compte+montant_band.

Pour chaque candidat sur **toutes** les transactions (catégorisées + non) :
- `precision` = transactions cohérentes / matches
- `recall` = matches / population estimée
- `f1`

Output : top 3 patterns triés f1 avec exemples positifs/négatifs.

`SuggestAutomationDialog` propose les 3 candidats au lieu de l'extraction "2 mots". L'extraction locale `extractPatternLocally` est supprimée.

### PR5 — Normalizer + merchant_key + backfill safe

Module `_shared/transactionNormalizer.ts` :
```
normalize(raw) => {
  raw_description, normalized_description, clean_label,
  merchant_key, merchant_name, merchant_type,
  merchant_confidence,
  bank_account_id, amount_abs, amount_sign,
  day_of_month, is_recurring,
  fingerprint,
  normalizer_version
}
```

Dictionnaire :
- `_shared/merchants/dictionary.yml` global versionné (URSSAF, ACOSS, Amazon, Stripe, Shopify, Google, Meta, Orange, EDF, Free, SFR, OVH, AWS, Hetzner, ...)
- Table `company_merchant_overrides` (company_id, alias_pattern, merchant_key, merchant_category_preference) — chaque société peut surcharger ("AMAZON" → fournitures vs AWS)
- Table `merchant_category_preferences` (company_id, merchant_key, default_category_id) — préférence locale

Migrations `transactions` :
- `merchant_key`, `merchant_name`, `merchant_type`, `merchant_confidence`
- `fingerprint`, `is_recurring`
- `normalizer_version`, `normalized_at`
- `merchant_locked_by_user bool` (true si édité manuellement)
- Index sur `(company_id, merchant_key)`, `(company_id, fingerprint)`

**Backfill safe** :
- Job batch en mode `dry-run` d'abord (écrit dans table miroir `transactions_normalization_preview`)
- Ne rien écrire si `merchant_confidence < seuil`
- **Ne jamais écraser un `merchant_key` avec `merchant_locked_by_user=true`**
- Stocke `normalizer_version` à chaque écriture pour permettre re-normalisations ciblées

Hook `bridge-sync` : appelle le normalizer à l'insertion.

### PR6 — Conditions enrichies + dépréciation `bank_account_name`

Étend `automation_rule_conditions.condition_field` :
- `merchant_key` (equals)
- `bridge_account_id` / `bank_account_id`
- `amount_around` (±%)
- `recurrence` (bool)
- `day_of_month_between`

`bank_account_name` : marqué `legacy` dans l'UI avec bandeau "Convertir en condition par compte (ID stable)". Toujours fonctionnel pour règles existantes mais absent des nouveaux formulaires.

Pattern scorer (PR4) enrichi : pondère désormais `merchant_key` quand disponible.

---

## Phase 3 — IA contextuelle + workflow review (PR7 → PR8)

### PR7 — `classify-transaction` (remplace `suggest-category`)

Edge function combinant, dans cet ordre, avec **`confidence_source` tracé** :

1. `exact_rule` — règle validée auto_apply, confidence ≥ 0.98
2. `fingerprint_history` — même fingerprint déjà classé ≥ 3× même catégorie
3. `merchant_history` — merchant_key même société classé ≥ 5× même catégorie
4. `global_dictionary` — préférence merchant globale
5. `llm` — Lovable AI (`google/gemini-3-flash-preview`) en arbitrage avec contexte enrichi (merchant_key, 5 derniers similaires, règles existantes, montant, compte, type)

Output (tool calling) :
```
{
  category_id, confidence, confidence_source,
  decision: 'auto'|'suggest'|'review',
  reason_codes, evidence
}
```

**Politique de décision stricte** :
- `auto` UNIQUEMENT si `confidence_source ∈ {exact_rule, fingerprint_history, merchant_history}` ET `confidence ≥ 0.98` ET catégorie non-sensible
- `llm` seul → max `suggest` (jamais `auto`)
- Catégorie sensible (cf PR10) → toujours max `suggest`
- Montant > seuil société → toujours max `suggest`

### PR8 — Review queue persistante + feedback events

Table `transaction_category_suggestions` :
- `transaction_id`, `suggested_category_id`
- `confidence`, `confidence_source`
- `reason_codes jsonb`, `evidence jsonb`
- `source` (`classify`|`rule_suggest_only`|`recommender`)
- `status` (`pending`|`accepted`|`rejected`|`expired`)
- `created_at`, `resolved_at`, `resolved_by`
- Expiration auto à 30j

Table `automation_feedback_events` :
- `event_type` (`suggestion_accepted`, `suggestion_rejected`, `category_changed_before_validation`, `rule_disabled`, `rule_ignored`, `run_rolled_back`, `auto_application_corrected`)
- `transaction_id`, `rule_id`, `suggestion_id`, `run_id`
- `previous_value`, `new_value`, `user_id`, `created_at`

Le runner en mode `suggest_only` écrit dans `transaction_category_suggestions` au lieu d'appliquer. UI : page Transactions → filtre "À valider (X)".

Tous les signaux (acceptation, refus, correction, désactivation, rollback) alimentent `automation_feedback_events` → consommé par PR9.

---

## Phase 4 — Apprentissage continu + garde-fous (PR9 → PR10)

### PR9 — CRON `detect-automation-opportunities`

pg_cron quotidien 6h UTC. **Non destructif : ne crée jamais de règle active, propose toujours.**

Détecte :
- merchant_key classé ≥ 5× pareil sans règle
- fingerprint mensuel récurrent
- règle existante qui aurait matché 40 transactions historiques (élargissement)
- règle souvent corrigée (signal `automation_feedback_events`) → propose restriction (compte / montant / merchant)
- règles en conflit → propose fusion ou ajustement priorité
- catégories souvent corrigées → suggère retraining mapping local

Sortie : `automation_rule_suggestions` (id, company_id, type, payload jsonb, status, dismissed_at, accepted_rule_id, evidence_examples jsonb).

UI : carte "X opportunités détectées" avec accept/dismiss/éditer.

### PR10 — Modes + garde-fous sensibles + reclassify_existing

`automation_rules` :
- `mode` : `disabled` / `suggest_only` / `auto_apply_after_review` / `auto_apply`
- `min_confidence`, `max_amount`
- `bank_account_scope[]`, `category_type_scope`
- `review_required_if_conflict bool`
- `reclassify_existing bool default false`

`categories` :
- `is_sensitive bool` (URSSAF, salaires, impôts, TVA, emprunts, virements intercomptes, remboursements) → bloque `auto_apply` direct
- `review_threshold_amount numeric` (override par catégorie)

Runner :
- Par défaut : `findUncategorized` uniquement (préserve principe actuel)
- Si `reclassify_existing=true` : confirmation explicite + double dry-run + log dédié

---

## Ce qui n'est volontairement PAS fait

- Pas d'apprentissage cross-tenants (RGPD)
- Pas de ML custom (Lovable AI suffit en arbitrage)
- Pas de migration forcée des règles legacy `bank_account_name` (deprecation soft)
- `action_type` reste `categorize` pour Phase 1-3, mais migration `categorize|set_vat|set_recurring|ignore|mark_intercompany|split_hint` anticipée dans le schéma (enum extensible)

---

## Tests & observabilité

- Vitest : normalizer, pattern scorer, ruleScoring (`specificity_score`), calcul stats réelles
- Deno tests : toutes les nouvelles edge functions
- Golden fixtures : 50 libellés bancaires français réels
- Dashboard super-admin : `stability_rate_30d`, `correction_rate`, `conflict_rate`, top merchants non couverts, taux d'auto-application

---

## Décision attendue

Démarrer par **PR1 (dry-run serveur)** seul, le valider en production avec quelques clients pilotes, puis enchaîner PR2 et PR3. Cette séquence donne une promesse commerciale activable dès PR1+PR2+PR3 sans dépendre de la Phase 2.

