# Plan validé : modèle à deux niveaux + vue SQL centrale

Le CTO a raison sur le fond. Mon plan précédent traitait la suppression d'item Bridge correctement, mais laissait `is_ignored` jouer trois rôles à la fois. Je le remplace par un modèle propre.

## 1. Refonte du modèle de données

### `company_bridge_accounts` — décision métier (par société)
Ajouter :
- `status text not null default 'active' check (status in ('active','excluded'))`
- `excluded_at timestamptz null`
- `excluded_by uuid null references auth.users(id)`
- `exclusion_reason text null`

Règle : on ne supprime plus une assignation pour "masquer". On la passe à `excluded`. La sync respecte cette décision pour toujours.

### `bridge_accounts` — état technique (canonique Bridge)
Ajouter :
- `lifecycle_status text not null default 'active' check (lifecycle_status in ('active','disabled','deleted','replaced'))`
- `replaced_by_bridge_account_id bigint null references bridge_accounts(bridge_account_id)`
- `duplicate_confidence numeric null`
- `duplicate_reason text null`

Migration : backfill `lifecycle_status` depuis `status` actuel + `is_ignored=true && status='replaced'` → `replaced`. Puis `is_ignored` reste en colonne legacy (lecture seule, marquée `@deprecated`) le temps de la transition, retiré dans une migration suivante une fois tous les usages purgés.

### `transactions` — clé forte de compte
- Vérifier `bridge_account_id` présent (déjà ajouté). Sinon le créer.
- Backfill : mapper `bank_account_name` → `bridge_account_id` uniquement quand le couple `(company_id, bridge_user_uuid, name)` est non ambigu.
- Indexer `(company_id, bridge_account_id)`.

## 2. Vue SQL centrale — source unique de vérité

```sql
create or replace view public.company_active_bridge_accounts as
select
  cba.company_id,
  cba.bridge_account_id,
  ba.name, ba.iban, ba.balance, ba.currency_code,
  ba.account_type, ba.bridge_item_id, ba.bridge_user_uuid,
  ba.last_refresh_status, ba.updated_at
from public.company_bridge_accounts cba
join public.bridge_accounts ba using (bridge_account_id)
where cba.status = 'active'
  and ba.lifecycle_status = 'active';
```

RLS : SECURITY INVOKER, policies héritées des tables sources via `has_company_access`.

## 3. Tous les consommateurs lisent la vue

Refactor obligatoire — plus aucun JOIN manuel `company_bridge_accounts → bridge_accounts` ailleurs :
- `useBankBalance` (frontend)
- Dashboard "Solde total" (pastille + dropdown groupé par `bridge_item_id`)
- `BankAccountsCard` (Settings) — lecture via vue, écriture via mutation status
- `snapshot-balances` edge
- `recompute_company_bank_stats` SQL function — refaite pour sommer la vue
- `bridge-sync` cron (sélection des comptes à rafraîchir = vue + comptes assignés actifs uniquement, mais sync technique continue sur tous les comptes Bridge non-deleted)

## 4. Auto-assign : one-shot et respectueux

Nouvelle règle dans `bridge-sync` :
- Si une ligne existe déjà dans `company_bridge_accounts` (active OU excluded) pour ce `bridge_account_id` → ne rien faire.
- Si `lifecycle_status != 'active'` → ne rien faire.
- Sinon, première connexion : auto-assign uniquement si la société est seule sur ce `bridge_user_uuid` ET aucune décision n'a jamais été prise (audit log vide ou flag `first_connection_handled` sur `bridge_users`).
- Sinon → laisser non assigné (l'utilisateur choisit).

## 5. Déduplication / replaced

Fingerprint composite (au lieu de IBAN + bridge_user_uuid seul) :
`(bridge_user_uuid, iban_normalisé, currency, account_type, bank_item_id)`

Décision automatique de `replaced` UNIQUEMENT si :
- fingerprint identique
- ancien item `disabled`/`deleted` côté Bridge OU `last_successful_refresh > 14j`
- nouveau compte plus récent

Sinon → `duplicate_confidence` calculé + `duplicate_reason` rempli, mais on ne touche pas au statut. UI affichera un bandeau "Doublon suspect, à valider".

Re-mapping transactions : seulement quand `replaced` est confirmé, et via `transactions.bridge_account_id` (jamais via `bank_account_name`).

## 6. UI Dashboard

- Afficher l'IBAN masqué (`****4046`) à côté de chaque compte dans la pastille et le dropdown.
- Bouton "Masquer ce compte" sur chaque ligne → mutation `status='excluded'` + raison optionnelle.
- Section "Comptes masqués" repliée avec bouton "Réintégrer".
- Suppression d'item bancaire complète (plan précédent) reste valide : c'est une action différente, qui hard-delete côté Bridge + soft-delete côté DB.

## 7. Suppression des écritures de solde côté frontend

`BankAccountsCard` n'écrit plus `companies.bank_balance` ni `bridge_accounts_count`. Il appelle uniquement la mutation d'assignation/exclusion. Trigger `trg_recompute_on_cba_change` (déjà présent) fait le reste.

## 8. Correction Vapeclub (data, pas hack)

Migration data dédiée :
1. Identifier les 2 vrais comptes à garder (par IBAN).
2. Passer les comptes non désirés en `company_bridge_accounts.status='excluded'` avec raison "nettoyage manuel CTO 2026-05".
3. Marquer le doublon technique `...4072` dupliqué en `bridge_accounts.lifecycle_status='replaced'` + `replaced_by_bridge_account_id`.
4. `select recompute_company_bank_stats('<vapeclub_id>')`.

Pas de hardcoding dans le code applicatif.

## 9. Webhook & sync — bridge_account_id partout

Déjà identifié : `bridge-webhook.handleAccountUpdated` n'écrit pas `bridge_account_id` sur les transactions. Correction obligatoire avant tout remap.

## 10. Tests

- Deno tests `bridge-sync` : auto-assign respecte `excluded`, ne ré-assigne jamais un compte déjà décidé, marque `replaced` selon fingerprint fort.
- Deno tests `bridge-delete-item` (du plan précédent).
- Unit test SQL : `company_active_bridge_accounts` exclut bien `excluded` et `replaced`.
- Unit test `recompute_company_bank_stats` : somme = vue.

## Ordre d'exécution

1. Migration : colonnes `status`/`lifecycle_status` + backfill depuis `is_ignored`.
2. Vue `company_active_bridge_accounts`.
3. Refonte `recompute_company_bank_stats` sur la vue.
4. Refacto `useBankBalance`, Dashboard, `BankAccountsCard`, `snapshot-balances` → vue.
5. Webhook : remplir `bridge_account_id` sur transactions.
6. Auto-assign one-shot dans `bridge-sync`.
7. Détection `replaced` avec fingerprint fort.
8. UI : bouton masquer + IBAN masqué + section "Comptes masqués".
9. Edge `bridge-delete-item` (du plan précédent, conservée).
10. Migration data Vapeclub.
11. Tests.
12. Migration future : drop `bridge_accounts.is_ignored` une fois zéro usage.

## Ce que je refuse

- Garder `is_ignored` comme champ unique multi-rôle.
- Disperser des filtres `is_ignored = false` dans les hooks.
- Auto-replace silencieux sur simple match IBAN+user_uuid.
- Toute suppression locale d'un compte que Bridge réexpose.
- Hardcoder Vapeclub dans le code.
