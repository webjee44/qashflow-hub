## Cause racine

`company_bridge_accounts` accepte plusieurs liens vers un même compte bancaire réel. Deux mécanismes cassent le solde :

1. Quand l'utilisateur reconnecte une banque, Bridge émet un nouveau `bridge_user_uuid` et de nouveaux `bridge_account_id` pour les mêmes comptes physiques. Les anciens liens restent actifs et continuent d'être synchronisés → soldes additionnés deux fois.
2. Aucune contrainte (DB ni code) n'empêche d'attacher deux fois le même IBAN à la même société.

Conséquence visible chez SAS Vapeclub : 7 lignes au lieu de 4, total gonflé d'environ 33 500 €.

## Approche : 3 couches, du plus structurel au moins risqué

### 1. Source de vérité : un compte physique = une ligne par société

Définir l'identité métier d'un compte bancaire :
- `iban` quand il existe (comptes courants)
- sinon fallback `(bridge_user_uuid, account_name, type)` (cartes, comptes sans IBAN)

Ajouter une fonction SQL `bank_account_identity(bridge_account_id) returns text` qui retourne cette clé. Elle vit dans `_shared` côté logique métier et est utilisée partout (sync, assignment, balance computation).

### 2. Cycle de vie de `bridge_user_uuid`

Aujourd'hui un UUID n'est jamais marqué obsolète. On introduit :
- Table `bridge_user_connections (bridge_user_uuid pk, company_id, status enum('active','superseded','revoked'), created_at, superseded_at)`.
- À chaque nouvelle connexion Bridge pour une société : on marque les UUID précédents `superseded` automatiquement si leurs IBANs sont couverts par le nouveau.
- `bridge-sync` et le calcul de solde n'incluent que les UUID `active`.
- `bridge-webhook` respecte la même règle.

Cela règle le cas "ancienne connexion oubliée" sans intervention manuelle, et c'est le vrai correctif du problème évoqué dans le contexte précédent.

### 3. Garde-fous DB

Sur `company_bridge_accounts` :
- Index unique partiel : `(company_id, normalized_iban) where normalized_iban is not null`.
- Index unique : `(company_id, bridge_account_id)` (déjà implicite via PK composite probable, à vérifier).

Sur `bridge_accounts` : index unique `(bridge_user_uuid, bridge_account_id)` pour empêcher la duplication côté ingest.

Trigger BEFORE INSERT/UPDATE qui refuse un lien si un autre lien actif existe déjà pour la même identité métier dans la même société.

## Migration de l'état actuel

Script idempotent qui, pour chaque société :
1. Calcule l'identité métier de chaque `bridge_account` rattaché.
2. Pour chaque groupe d'identité, garde le lien dont le `bridge_account` a le `last_sync_at` le plus récent.
3. Supprime les `company_bridge_accounts` redondants.
4. Marque les `bridge_user_uuid` orphelins (plus aucun lien actif) comme `superseded`.

Pour Vapeclub spécifiquement : passe de 7 → 4 comptes, solde recalculé automatiquement par les hooks existants (`useBankBalance`, `useDashboardStats`) puisqu'ils consomment `company_bridge_accounts`.

## Impact sur le code existant

| Zone | Changement |
|---|---|
| `supabase/functions/bridge-sync` | Filtre les UUID `active` uniquement (plus simple que la logique précédente, plus correcte) |
| `supabase/functions/bridge-webhook` | Même filtre + déclenche le marquage `superseded` quand un nouvel UUID couvre les mêmes IBANs |
| `supabase/functions/bridge-connect` (post-link callback) | Insère la connexion dans `bridge_user_connections` et déclenche la dédup |
| `supabase/functions/bridge-accounts` (assignment UI) | Affiche uniquement les comptes des UUID `active` |
| `useBankBalance`, `useDashboardStats`, `useGroupBalances` | Aucun changement — ils lisent déjà `company_bridge_accounts`, qui sera nettoyée |

## Tests

- Deno : `bridge-sync` ignore les UUID `superseded` ; `bridge-connect` marque correctement les anciens UUID quand les IBANs sont couverts.
- Unit : fonction `bankAccountIdentity` (priorité IBAN > fallback) avec cas limites (carte sans IBAN, IBAN avec espaces, casse).
- Migration : test SQL qui crée le scénario doublon Vapeclub et vérifie qu'on retombe sur 4 lignes.

## Plan d'exécution

1. Migration DB : table `bridge_user_connections`, fonction `bank_account_identity`, contraintes, trigger, backfill des connexions existantes en `active`.
2. Script de dédup one-shot, exécuté dans la même migration (transactionnel).
3. Mise à jour `bridge-sync`, `bridge-webhook`, `bridge-connect`, `bridge-accounts` pour respecter `bridge_user_connections.status`.
4. Tests Deno + unit.
5. Vérification UI sur Vapeclub via browser.

## Hors scope

- Pas de changement de l'UX d'assignment des comptes (la liste sera juste plus propre).
- Pas de migration vers une nouvelle abstraction "BankAccount logique" séparée de `bridge_account` — on garde `company_bridge_accounts` comme table de jointure, mais avec la garantie d'unicité.
