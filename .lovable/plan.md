## Objectif PR1

Unifier le moteur d’automatisation côté serveur sans toucher aux splits, créations manuelles, decategorize ni au diagnostic. Tout matching métier doit passer par une seule source de vérité, avec sécurité tenant stricte et décisions explicites par transaction.

## Cause racine traitée

Aujourd’hui, `apply-automation-rule`, `apply-all-automation-rules` et `automation-rule-preview` reconstruisent chacun leur propre `matchesRule` et leur propre orchestration. Le frontend peut donc afficher “une règle couvre déjà cette transaction” alors que le runner appliqué n’a pas écrit la catégorie. La correction consiste à supprimer ces variantes au profit d’un moteur partagé, et à brancher Bridge dessus.

## Périmètre PR1

Inclus :

- nouveau module `supabase/functions/_shared/automationRuleEngine.ts`
- refonte de `apply-automation-rule`
- refonte de `apply-all-automation-rules`
- refonte de `automation-rule-preview`
- appel `bridge-sync` aligné sur le nouveau contrat
- tests : VAPOSTORE + conflit

Exclus de PR1 :

- splits
- créations manuelles
- `decategorize-rule-transactions`
- `explain-rule-match`
- refacto du frontend (`useAutomationRules`, modal, boutons)

Le frontend continue d’appeler `apply-automation-rule`, `apply-all-automation-rules`, `automation-rule-preview` avec le même contrat HTTP qu’aujourd’hui. Aucun changement UI dans cette PR.

## Détail technique

### 1. Module partagé `automationRuleEngine.ts`

Responsabilités :

- charger les règles actives d’une société (via repository existant)
- charger les conditions additionnelles
- charger les types des catégories cibles
- normaliser les règles dans un contrat unique
- tester une transaction contre une règle via `automationRuleMatchingCore.ts`
- résoudre la règle gagnante (priorité, specificity, created_at)
- détecter les conflits via `isConflictingScore`
- produire un `RunItemInput` d’audit cohérent

Surfaces publiques :

```ts
type Decision =
  | 'applied'
  | 'no_match'
  | 'already_categorized'
  | 'type_mismatch'
  | 'target_category_invalid'
  | 'conflict';

interface TransactionDecision {
  transaction_id: string;
  decision: Decision;
  winning_rule_id: string | null;
  target_category_id: string | null;
  competing_rules?: string[];
  reason_codes: string[];
}

interface ApplyArgs {
  companyId: string;
  userId: string;          // utilisateur initiateur (auth) ou null pour cron
  triggeredBy: 'manual' | 'cron' | 'system' | 'bridge_sync';
  ruleId?: string;         // restreint à une seule règle si fourni
  transactionIds?: string[]; // restreint à un sous-ensemble si fourni
  dryRun: boolean;
}

interface ApplyResult {
  runId: string | null;
  matched: number;
  applied: number;
  skippedConflict: number;
  decisions: TransactionDecision[];
}

async function applyAutomationRulesForCompany(args: ApplyArgs): Promise<ApplyResult>;
```

Le moteur est idempotent : il ne traite que les transactions non catégorisées, et `applied` n’écrase jamais une catégorie existante.

### 2. Sécurité tenant obligatoire dans l’orchestrateur

Avant tout dry-run ou application, `applyAutomationRulesForCompany` doit :

- vérifier que `companyId` est non nul
- si `userId` est fourni (appel utilisateur) : vérifier que l’utilisateur a bien accès à `companyId` via la table d’appartenance (organization/companies), sinon throw `403`
- si `ruleId` est fourni : vérifier que `rule.company_id === companyId` et `rule.is_active === true`, sinon throw `403`
- si `transactionIds` est fourni : vérifier que toutes les transactions appartiennent à `companyId` et ne sont pas supprimées, sinon throw `403`
- vérifier la cohérence `ruleId` ↔ `companyId` ↔ `transactionIds` ; toute incohérence fait throw

Pour `triggeredBy: 'cron' | 'system' | 'bridge_sync'` : pas de check user, mais `companyId` reste obligatoire et toutes les autres vérifications restent actives.

Ces vérifications vivent dans l’orchestrateur, pas dans les endpoints. Les endpoints ne font que de la validation de schéma + auth + appel orchestrateur.

### 3. Décisions explicites et idempotence

Pour chaque transaction testée (uniquement non catégorisées + non supprimées + appartenant à la société), le moteur retourne exactement une décision :

- `applied` : règle gagnante trouvée, écriture effectuée (ou planifiée en dry-run)
- `no_match` : aucune règle ne matche
- `already_categorized` : la transaction a déjà une catégorie, ignorée
- `type_mismatch` : règle matchait mais le type de la catégorie cible ne correspond pas au type transaction
- `target_category_invalid` : règle matchait mais `target_category_id` manquant ou catégorie introuvable
- `conflict` : deux règles candidates de scores proches vers des catégories différentes, aucune n’est appliquée

Toutes les décisions non-trivialement `no_match` produisent un `automation_run_items` avec `reason_codes` cohérent. Le run est créé même à zéro match (audit), comme aujourd’hui.

Idempotence : un second appel sur la même société sans nouvelle transaction non catégorisée doit retourner `applied: 0`.

### 4. Endpoints refactorisés

`apply-automation-rule` :

- valide `rule_id` + `company_id` via Zod
- auth `getUser` obligatoire
- appelle `applyAutomationRulesForCompany({ companyId, userId, triggeredBy: 'manual', ruleId, dryRun: false })`
- retourne `{ matched, updated, run_id }` (contrat HTTP inchangé)

`apply-all-automation-rules` :

- valide `company_id` requis pour les appels utilisateur ; pour les appels CRON sans auth, le contrat reste mais l’endpoint itère société par société en appelant l’orchestrateur (qui exigera `companyId`)
- appelle l’orchestrateur en `dryRun: false`
- retourne `{ matched, updated }`

`automation-rule-preview` :

- valide le payload existant
- appelle l’orchestrateur en `dryRun: true` avec un mode “preview ad hoc” qui injecte des conditions/règles candidates non encore persistées
- pour rester compatible avec la preview d’une règle non créée, ajouter au moteur un mode `applyAutomationRulesForCompanyPreview({ companyId, userId, candidateRule, ruleIdBeingEdited })` qui réutilise la même fonction interne de matching/scoring et produit `PreviewResult`
- contrat HTTP inchangé

### 5. Branchement `bridge-sync`

Remplacer les `fetch` vers `apply-all-automation-rules` par un appel direct à `applyAutomationRulesForCompany` dans le même runtime, avec :

- `companyId` = société impactée
- `userId` = null
- `triggeredBy` = `'bridge_sync'`
- `dryRun` = false

Garantie : seules les transactions non catégorisées de la société impactée sont traitées. Aucun cross-tenant possible.

### 6. Tests obligatoires

Tests Deno dans `supabase/functions/_shared/tests/automationRuleEngine.test.ts` avec mocks repository :

Test 1 — VAPOSTORE :

- transaction non catégorisée : `VIR VAPOSTORE Vapostore Cloudvapor 202601380`, `amount: 10089.12`, `type: 'income'`, `company_id: C1`
- règle active dans `C1` : `description contains VAPOSTORE → cat-ventes` (catégorie type `income`)
- appel `applyAutomationRulesForCompany({ companyId: C1, triggeredBy: 'system', dryRun: false })`
- attendu : `applied = 1`, décision `applied`, `winning_rule_id` correct, écriture `category_id = cat-ventes`
- second appel : `applied = 0` (idempotence)

Test 2 — conflit :

- deux règles actives de specificity proches vers `cat-A` et `cat-B`
- une transaction matche les deux
- attendu : décision `conflict`, `competing_rules` contient les deux ids, aucune écriture, `skippedConflict = 1`

Test 3 — sécurité tenant :

- règle appartient à `C1`, appel avec `companyId: C2` → throw
- transactionIds d’une autre société → throw
- userId sans accès à companyId → throw

## Validation

- exécution `supabase--test_edge_functions` ciblée sur les nouveaux tests
- déploiement des trois endpoints
- appel manuel `apply-all-automation-rules` pour Cloud Vapor : vérifier que les transactions VAPOSTORE non catégorisées sortent catégorisées
- vérifier que la preview du modal renvoie un compte cohérent avec ce que le runner appliquerait

## Hors scope explicite

- splits / créations manuelles de transactions
- `decategorize-rule-transactions`
- `explain-rule-match`
- refonte UI du modal et du bouton “Appliquer la règle existante”
- refonte `useAutomationRules` (toggle/update double appel)

Ces points feront l’objet de PR ultérieures, une fois le moteur unique en place et stable.