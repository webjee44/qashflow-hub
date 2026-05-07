# Verrou DB anti-réactivation des comptes Bridge

## Cause racine

L'exclusion actuelle vit uniquement dans `company_bridge_accounts.status='excluded'`. Tout chemin (sync Bridge, script, écran, upsert) qui repasse une ligne à `active` rouvre la fuite. Le trigger actuel `prevent_excluded_to_active_reactivation` ne se déclenche que si les champs d'exclusion sont encore présents — un upsert qui les écrase passe au travers. Il faut donc une **source de vérité indépendante** : une blacklist persistante qui ne peut pas être contournée par la sync.

## Ce que je vais faire

### 1. Nouvelle table `bridge_account_blocks` (verrou métier)

Table dédiée, RLS stricte (lecture/gestion réservée aux propriétaires de la société + superadmin), avec index sur `(company_id, bridge_account_id)` et `(company_id, is_active)`.

Champs : `company_id`, `bridge_account_id`, `bridge_item_id`, `bridge_user_uuid`, `iban`, `iban_last4`, `account_identity` (calculé via `compute_bridge_account_identity` pour résister au changement d'ID Bridge), `reason`, `blocked_at`, `blocked_by`, `is_active`.

### 2. Trigger `prevent_blocked_bridge_account_activation`

`BEFORE INSERT OR UPDATE` sur `company_bridge_accounts`. Si `(company_id, bridge_account_id)` figure dans `bridge_account_blocks` avec `is_active = true`, force `status='excluded'` + remplit `excluded_at` / `exclusion_reason`. Indépendant du trigger existant — les deux cohabitent.

### 3. Vue `company_active_bridge_accounts` mise à jour

Ajout d'un `NOT EXISTS` qui exclut explicitement tout `(company_id, bridge_account_id)` blacklisté. Double sécurité : même si une ligne `cba` reste à `active` par erreur, elle n'apparaît plus dans la vue.

Aussi : exclusion par `account_identity` (IBAN normalisé). Si Bridge renvoie le même compte sous un nouvel ID, il est bloqué d'office.

### 4. Soft-delete des transactions par `bridge_account_id` (jamais par nom)

Trigger `soft_delete_transactions_on_block_insert` : à l'insertion d'un block actif, soft-delete toutes les transactions correspondantes via `bridge_account_id` uniquement.

### 5. Recompute soldes

Appel à `recompute_company_bank_stats(company_id)` à la fin de la migration et après chaque insertion/désactivation de block (via trigger).

### 6. Blocage immédiat des 3 comptes Vapeclub

Insertion ciblée dans `bridge_account_blocks` pour la société Vapeclub via les critères fournis (IBAN se terminant par 4072 / 6102 / 6902, ou nom contenant 2761 / 9269). Récupération préalable du `company_id` Vapeclub via lecture DB.

### 7. Hardening edge functions

- **`bridge-sync`** : avant tout upsert dans `company_bridge_accounts` ou route de transaction, charger la blacklist de la société et filtrer. Aucun fallback, aucune auto-assignation, aucun routage sur un compte blacklisté.
- **`bridge-accounts/get-accounts`** : confirmer qu'avec `company_id`, on lit exclusivement `company_active_bridge_accounts` (déjà fait à l'étape précédente, mais re-vérifier qu'aucun chemin n'utilise `fetchAllAccounts` pour l'UI). L'endpoint debug raw reste superadmin only.

### 8. UI Paramètres — gestion de la blacklist

Dans `BankAccountsCard`, ajouter une 3e section "Comptes bloqués (verrou)" affichant les blocks actifs, avec :
- bouton "Lever le blocage" (réservé Owner) qui passe `is_active=false` après confirmation forte ;
- explication courte : "ces comptes ne peuvent plus revenir, même après synchronisation".

### 9. Tests de non-régression

- **Deno test `bridge-sync`** : Bridge renvoie un compte blacklisté → la ligne `company_bridge_accounts` ressort `excluded`, aucune transaction n'est créée, le solde n'est pas impacté.
- **Deno test `bridge-accounts`** : `get-accounts(company_id)` ne retourne jamais un compte blacklisté.
- **Test SQL** : tentative manuelle d'`UPDATE company_bridge_accounts SET status='active'` sur une ligne blacklistée → la valeur reste `excluded` après commit.
- **Test identité** : insertion d'un nouveau `bridge_account_id` partageant l'`account_identity` d'un compte blacklisté → exclu d'office.

### 10. Critères de clôture (5 requêtes)

J'exécute après la migration les 5 SELECT fournis et je joins le résultat. Le ticket n'est clos que si :
- blocks Vapeclub présents et actifs ;
- 0 ligne `cba.status='active'` joint blocks ;
- 0 transaction active sur comptes bloqués ;
- 0 ligne dans la vue pour ces comptes ;
- la liste des comptes actifs Vapeclub correspond aux comptes légitimes.

## Détails techniques

```text
                      bridge-sync
                          │
                          ▼
       ┌───────────── filtre blacklist ──────────┐
       │                                         │
       ▼                                         ▼
company_bridge_accounts                    transactions
       │  ▲                                       │
       │  └── trigger anti-réactivation ──────────┤
       ▼                                          ▼
company_active_bridge_accounts (NOT EXISTS blacklist)
       │
       ▼
        UI (Dashboard, Paramètres)
```

Tables/objets touchés :
- **Nouveau** : `bridge_account_blocks` (+ RLS, index, triggers).
- **Modifié** : vue `company_active_bridge_accounts`, fonction `bridge-sync/index.ts`, fonction `bridge-accounts/index.ts` (re-vérification).
- **UI** : `src/components/settings/BankAccountsCard.tsx` (section "Comptes bloqués"), nouvelle API dans `src/features/bank/api` pour CRUD blocks.
- **Tests** : Deno tests pour `bridge-sync` et `bridge-accounts`, test SQL anti-réactivation.

## Risque & rollback

- Le block est réversible (`is_active=false` + suppression du block lève le verrou et le compte peut revenir si la sync le renvoie).
- Aucune donnée n'est supprimée durement : transactions restent en soft-delete, comptes restent en `excluded`.
- Migration idempotente : `CREATE IF NOT EXISTS`, triggers `DROP IF EXISTS` avant recréation.
