## Cause racine

Bridge supprime à la granularité **item** (= 1 connexion banque), pas par compte. Le code actuel a deux dettes critiques :

1. **`bridge-webhook` ne remplit ni `bridge_account_id` ni `bridge_transaction_id`** sur les transactions qu'il insère (cf. `handleAccountUpdated` lignes ~280-295 : pas de `bridge_account_id: account_id` ni de `bridge_transaction_id: t.id`). Conséquence : impossible de cibler proprement les transactions à nettoyer → fallback dégradé sur `bank_account_name`.
2. **Trigger `cleanup_orphan_transactions_on_unassign`** (migration 20260505071622) hard-delete par `bank_account_name`. Avec deux comptes "Compte Cheques 1" partageant le même nom → suppression croisée potentielle.

## Plan révisé (ordre strict)

### Étape 1 — Renforcer le webhook (préalable indispensable)

`supabase/functions/bridge-webhook/index.ts`, dans `handleAccountUpdated`, l'objet `upsertData` doit inclure :
- `bridge_account_id: account_id`
- `bridge_transaction_id: t.id`

Sans ça, étape 3 ne peut pas filtrer fiablement.

### Étape 2 — Désactiver et remplacer le trigger dangereux

Migration :
- `DROP TRIGGER trg_cleanup_orphan_transactions_on_unassign` + `DROP FUNCTION cleanup_orphan_transactions_on_unassign()`
- Recréer une version safe :
  ```sql
  -- soft-delete only by bridge_account_id, never by name
  UPDATE transactions
     SET deleted_at = now()
   WHERE source = 'bridge'
     AND company_id = OLD.company_id
     AND bridge_account_id = OLD.bridge_account_id
     AND deleted_at IS NULL;
  ```
- Backfill safety run : `UPDATE transactions SET bridge_account_id = ba.bridge_account_id FROM bridge_accounts ba WHERE transactions.bank_account_name = ba.name AND transactions.bridge_account_id IS NULL AND ba.company_id = transactions.company_id` **uniquement quand le nom est unique** par `(company_id, bridge_user_uuid)` — déjà partiellement fait, on consolide.

### Étape 3 — Nouvelle edge function `bridge-delete-item`

`POST { company_id, bridge_item_id }`, auth via `auth.getUser()`, body validé Zod.

Séquence :

1. **Vérif accès** : `has_company_access(user.id, company_id)` ; sinon 403.
2. **Charger tous les comptes de l'item** (admin client, pas de filtre company) :
   `SELECT id, bridge_account_id, bridge_user_uuid FROM bridge_accounts WHERE bridge_item_id = $1`.
3. **Charger toutes les assignations** :
   `SELECT bridge_account_id, company_id FROM company_bridge_accounts WHERE bridge_account_id IN (...)`.
4. **Garde multi-tenant** : si une assignation pointe vers une `company_id` ≠ celle demandée, renvoyer 409 avec `{ error: 'item_shared_with_other_companies', companies: [...] }`. La fonction n'agit jamais.
5. **Bridge API** : `DELETE /aggregation/users/{user_uuid}/items/{item_id}` (auth = access_token user, pattern `getAuthToken` déjà dans bridge-webhook → factoriser dans `_shared/bridge-client.ts`). 404 = succès idempotent.
6. **Soft-delete transactions** :
   ```sql
   UPDATE transactions
      SET deleted_at = now()
    WHERE source = 'bridge'
      AND company_id = $1
      AND bridge_account_id = ANY($2::int[])
      AND deleted_at IS NULL;
   ```
7. **Supprimer assignations** : `DELETE FROM company_bridge_accounts WHERE bridge_account_id = ANY(...)`.
8. **Marquer comptes** : `UPDATE bridge_accounts SET status='deleted', is_ignored=true, item_status='deleted', item_status_updated_at=now() WHERE bridge_item_id = $1`.
9. `recompute_company_bank_stats(company_id)`.
10. Retour `{ deleted_accounts, soft_deleted_transactions, item_id }`.

### Étape 4 — Mutualiser dans `_shared/bridge-client.ts`

Ajouter :
- `getUserAccessToken(userUuid): Promise<string>`
- `deleteItem(userUuid, itemId): Promise<boolean>` (DELETE `/aggregation/users/{uuid}/items/{id}`, 404 → true)

`bridge-webhook` migrera à la classe partagée (suppression de la duplication).

### Étape 5 — UI

`BankAccountsCard.tsx` (Settings) + dropdown Dashboard "Solde total" :
- Grouper visuellement les comptes par `bridge_item_id` (badge banque)
- Action **"Supprimer cette connexion bancaire"** au niveau item, séparée de "Masquer ce compte"
- `AlertDialog` listant la banque, le nombre de comptes, le caractère définitif côté Bridge, la possibilité de reconnecter
- Si 409 multi-tenant → toast explicite listant les sociétés impactées (pas de demi-action)
- `invalidateQueries`: bridgeAccounts, transactions, dashboard stats, treasury

### Étape 6 — Tests

- `supabase/functions/bridge-delete-item/index_test.ts` (Deno) : 
  - mock Bridge 200 / 404 / 500
  - cas item partagé multi-companies → 409
  - cas accès refusé → 403
  - vérifie soft-delete par `bridge_account_id` exclusivement
- Test unit hook front pour la mutation

### Étape 7 — Cas Vapeclub (one-shot manuel via insert tool, pas de hardcode)

Une fois la fonction en prod, tu lances l'action UI sur les 2 items orphelins. Aucune logique spécifique Vapeclub dans le code.

## Fichiers touchés

- `supabase/functions/bridge-webhook/index.ts` — ajout `bridge_account_id` + `bridge_transaction_id` dans upsert
- `supabase/functions/_shared/bridge-client.ts` — `deleteItem`, `getUserAccessToken`
- `supabase/functions/bridge-delete-item/index.ts` — nouvelle
- `supabase/functions/bridge-delete-item/index_test.ts`
- Migration : drop+recreate `cleanup_orphan_transactions_on_unassign` (safe by `bridge_account_id`)
- Migration : backfill `transactions.bridge_account_id` quand mapping unique
- `src/features/bridge/api.ts` (créer si absent) : `deleteBridgeItem(companyId, itemId)`
- `src/components/settings/BankAccountsCard.tsx` — UI grouping + action delete item
- `src/pages/Dashboard.tsx` — même action dans le dropdown

## Garanties

- Aucun `bank_account_name` utilisé pour cibler des transactions.
- Aucun cas Vapeclub hardcodé.
- Aucune action si l'item est partagé multi-tenant (échec explicite, pas de demi-suppression).
- Soft-delete réversible côté local ; côté Bridge la suppression est définitive (assumée par la confirmation UI).
- Idempotent : rejouer la fonction sur un item déjà supprimé = no-op safe.