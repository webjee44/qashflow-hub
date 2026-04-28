## Contexte du bug

Sur l'écran "Mes sociétés", **E-fumeur Internet** affiche `0,00 €` et **0 compte** alors que la table `company_bridge_accounts` contient bien **3 comptes assignés à cette société**.

Toutes les autres sociétés de l'organisation (Cloud Vapor, Tradeflix, Vapostore Lanester/Vannes, Coachflix, Vapeflix) sont cohérentes parce qu'elles **possèdent leur propre `bridge_user_uuid`** : leurs comptes Bridge appartiennent à elles-mêmes ET sont assignés à elles-mêmes.

E-fumeur Internet est un cas particulier : elle est **propriétaire** d'un `bridge_user_uuid` (`d20d4144...`), mais ses 8 comptes Bridge ont tous été **réassignés à d'autres sociétés** (SAS Vapeclub, ZARA SARL d'autres organisations). À l'inverse, on lui a assigné 3 comptes appartenant à d'autres `bridge_user_uuid`.

## Cause racine

Les colonnes dénormalisées `companies.bank_balance` et `companies.bridge_accounts_count` sont calculées avec un modèle **bridge-owner-centric** qui n'est plus la source de vérité depuis l'introduction de `company_bridge_accounts` (mémoire `company-balance-isolation-truth`).

Concrètement, dans le code :

1. **`supabase/functions/bridge-sync/index.ts`** (`cron-sync` et `sync-accounts`)
   - Itère uniquement sur les sociétés ayant un `bridge_user_uuid` non null (ligne 426-429).
   - Calcule via `getAssignedAccountsStats(company_id, allAccounts)` où `allAccounts` provient du Bridge owner courant. Donc seuls les comptes du même bridge_user_uuid sont considérés.
   - Conséquence : E-fumeur Internet est bien itérée (elle a un bridge_user_uuid), mais comme ses comptes Bridge sont assignés ailleurs, le résultat est `(0, 0)`. Et les comptes étrangers qui lui sont assignés ne sont jamais agrégés à son nom.

2. **`supabase/functions/bridge-webhook/index.ts`** (ligne 319-332)
   - Agrège `bridge_accounts.balance` filtré par `bridge_accounts.company_id` (un champ legacy figé au moment de la création du compte) au lieu de passer par `company_bridge_accounts`.

3. **`supabase/functions/bridge-accounts/index.ts`** (ligne 80-94)
   - Écrit `bank_balance = totalBalance` (somme totale des comptes du Bridge owner) sans tenir compte des assignations. C'est complètement incorrect dès qu'une société a plusieurs comptes mais n'en assigne qu'une partie.

Bref, la définition "balance d'une société" est implémentée à 3 endroits avec 3 logiques différentes, dont aucune n'est alignée sur la source de vérité `company_bridge_accounts`.

## Solution proposée — Source de vérité unique

### 1. Centraliser le calcul dans une fonction SQL

Créer une fonction Postgres `public.recompute_company_bank_stats(p_company_id uuid)` (SECURITY DEFINER) qui :
- Lit toutes les lignes `company_bridge_accounts` pour `p_company_id`.
- Joint sur `bridge_accounts.balance`.
- Met à jour `companies.bank_balance`, `bank_balance_updated_at`, `bridge_accounts_count` en une seule requête atomique.

```sql
UPDATE companies SET
  bank_balance = COALESCE(SUM(ba.balance), 0),
  bridge_accounts_count = COUNT(*),
  bank_balance_updated_at = now()
FROM company_bridge_accounts cba
LEFT JOIN bridge_accounts ba ON ba.bridge_account_id = cba.bridge_account_id
WHERE cba.company_id = p_company_id AND companies.id = p_company_id;
```

(version réelle : recalculer même si zéro assignation pour bien retomber à 0).

### 2. Trigger automatique

Créer un trigger `AFTER INSERT/UPDATE/DELETE` sur :
- `company_bridge_accounts` → recompute pour `OLD.company_id` et `NEW.company_id`
- `bridge_accounts` (sur changement de `balance`) → recompute pour toutes les sociétés assignées à ce compte

Ainsi, **toute mutation de la source de vérité réconcilie automatiquement la donnée dénormalisée**. Plus besoin que chaque edge function se rappelle de faire le calcul.

### 3. Nettoyer les écritures legacy dans les edge functions

- **`bridge-sync/index.ts`** : remplacer les deux blocs `update({ bank_balance, bridge_accounts_count })` (lignes ~483 et ~650) par un appel à `supabase.rpc('recompute_company_bank_stats', { p_company_id })`. La fonction `getAssignedAccountsStats` peut être supprimée (elle dupliquait le calcul côté JS).
- **`bridge-webhook/index.ts`** (ligne 318-332) : remplacer l'agrégation manuelle par un appel à `recompute_company_bank_stats` pour **toutes** les sociétés assignées à `account_id` (via `company_bridge_accounts`), pas seulement `company_id`.
- **`bridge-accounts/index.ts`** (ligne 84-94) : supprimer purement l'écriture de `bank_balance` (le calcul est déjà fait par le trigger sur `bridge_accounts`).

### 4. Migration de réconciliation one-shot

Dans la même migration SQL, exécuter `recompute_company_bank_stats(id)` pour **toutes les sociétés non supprimées**. Cela corrige immédiatement E-fumeur Internet (et toute autre société dans le même cas latent).

### 5. Étendre le cron-sync

Aujourd'hui `cron-sync` n'itère que sur les sociétés ayant un `bridge_user_uuid`. Les sociétés satellites (qui reçoivent uniquement des comptes assignés) ne sont jamais "touchées" directement, mais grâce au trigger sur `bridge_accounts`, leur balance sera mise à jour dès qu'un compte source est rafraîchi. Aucun changement de structure du cron n'est nécessaire — juste s'assurer que `recompute_company_bank_stats` est bien déclenchée.

## Détails techniques (pour revue)

**Fichiers modifiés** :
- `supabase/migrations/<timestamp>_recompute_company_bank_stats.sql` (nouveau)
  - CREATE FUNCTION `recompute_company_bank_stats(uuid)`
  - CREATE TRIGGERS sur `company_bridge_accounts` et `bridge_accounts`
  - UPDATE one-shot pour réconcilier toutes les sociétés existantes
- `supabase/functions/bridge-sync/index.ts` : remplacer 2× les updates de balance par RPC, supprimer `getAssignedAccountsStats`
- `supabase/functions/bridge-webhook/index.ts` : remplacer l'agrégation par RPC sur toutes les sociétés assignées
- `supabase/functions/bridge-accounts/index.ts` : supprimer l'écriture de `bank_balance` (trigger s'en charge)

**Aucun changement frontend** — `useCompany` lit déjà les colonnes dénormalisées, qui deviendront fiables.

## Bénéfices

- **Une seule source de vérité** : `company_bridge_accounts` + trigger.
- **Zéro dette** : on supprime 3 implémentations divergentes au lieu d'en patcher une.
- **Auto-réconciliation** : impossible de désynchroniser à l'avenir, même si on ajoute un nouveau flux d'assignation.
- **E-fumeur Internet** affichera `cba_count` (3) comptes et la somme correcte des balances dès l'application de la migration.
- Aligné avec les mémoires existantes `company-balance-isolation-truth` et `bank-account-visibility-isolation`.

## Question

Souhaites-tu également que j'ajoute une **vérification de cohérence** (edge function diagnostique ou job nightly) qui logge les sociétés où `bridge_accounts_count` divergerait de `(SELECT COUNT(*) FROM company_bridge_accounts WHERE company_id = ...)` ? Avec le trigger ce ne devrait plus jamais arriver, mais c'est une ceinture+bretelles utile en prod.