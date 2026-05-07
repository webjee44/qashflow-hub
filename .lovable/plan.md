## Cause racine

`bridge-accounts/get-accounts` retourne la liste brute Bridge sans tenir compte des décisions Qashflow (`company_bridge_accounts.status = excluded`, `company_active_bridge_accounts`). Tant que ce chemin existe, les comptes exclus réapparaissent à chaque appel — et tous les écrans qui consomment cette API contournent la source de vérité.

Principe directeur :
- Bridge = source des comptes **disponibles**
- Qashflow = source des comptes **autorisés**

## Corrections

### 1. Fermer le contournement dans `bridge-accounts`

Action `get-accounts` :
- Si `company_id` est fourni : ne plus appeler Bridge. Lire `company_active_bridge_accounts` filtré sur `company_id`. Calculer `totalBalance` depuis cette vue. Retourner un champ `source: 'qashflow_company_active_bridge_accounts'`.
- Si `company_id` n'est pas fourni : refuser l'appel (400) ; le brut Bridge n'est plus exposé sur ce chemin.

Nouvelle action `get-bridge-raw-accounts` :
- Réservée debug/admin (vérification superadmin via `is_superadmin`).
- Conserve l'appel `bridgeClient.fetchAllAccounts()` pour usage technique uniquement.
- Jamais utilisée par dashboard/paramètres.

### 2. Aligner les écrans sur la source unique

- Dashboard `BankAccounts.tsx` : ne plus dépendre du payload brut. Il consomme déjà partiellement la vue via `useBankBalance`/`useGroupBalances` ; basculer aussi la liste détaillée sur `company_active_bridge_accounts`.
- Bandeau "Une banque nécessite une reconnexion" : continue de fonctionner via `item_status` lu depuis la vue.
- `ManageAccountsDialog.tsx` (legacy) : à retirer ou refondre — il fait des `delete` directs sur `company_bridge_accounts` puis réinsère, ce qui efface les décisions d'exclusion. Le seul écran de gestion devient `BankAccountsCard` qui sait gérer `excluded`.

### 3. Paramètres bancaires : rendre les exclusions visibles et pilotables

`BankAccountsCard` charge actuellement uniquement la vue active. Étendre :
- Charger en plus les liens `company_bridge_accounts.status = 'excluded'` rattachés à l'organisation, joints à `bridge_accounts`.
- Afficher 2 sections distinctes :
  - "Comptes actifs" (par banque, comportement actuel)
  - "Comptes masqués / exclus" (collapsée par défaut, avec raison d'exclusion + bouton "Réintégrer")
- L'action "désactiver" devient explicitement "Exclure durablement" (toast + confirmation), jamais une suppression destructive.

### 4. Garantir qu'une sync ne réactive jamais une exclusion

Dans `bridge-sync` (auto-assign single-company, dedup IBAN, upserts CBA) :
- Refuser tout `INSERT/UPDATE` sur `company_bridge_accounts` qui ferait passer une ligne `excluded` à `active` sans action utilisateur explicite.
- Implémenter cette garantie au niveau base de données via un trigger `BEFORE UPDATE` : si `OLD.status = 'excluded'` et `NEW.status = 'active'`, refuser sauf si `excluded_by` est explicitement remis à NULL par un appel de l'UI (signalé par `exclusion_reason = NULL` simultané).
- Dans le code edge : tous les `upsert(... onConflict: company_id,bridge_account_id)` ne doivent jamais écraser `status` côté serveur ; seul l'utilisateur peut.

### 5. Doublons : exclusion héritée seulement avec fingerprint fort

Modifier la logique `dedup` dans `bridge-sync` :
- Quand un nouveau `bridge_account_id` apparaît avec **même `company_id` (via assignation existante de l'ancien) + même `bridge_user_uuid` + même IBAN normalisé + même `account_type` + ancien item remplacé/obsolète**, propager l'état `excluded` de l'ancien lien vers le nouveau lien (`status='excluded'`, `exclusion_reason='Hérité du compte remplacé'`).
- Sinon : créer le nouveau lien comme `suspected_duplicate` (champ déjà couvert par `duplicate_confidence` / `duplicate_reason` côté `bridge_accounts`) et **ne pas l'activer automatiquement** : il reste non assigné jusqu'à décision utilisateur.

### 6. Nettoyage immédiat SAS Vapeclub

Migration data ciblée :
- Marquer le compte 61723202 (doublon IBAN ...4072 non assigné) avec `lifecycle_status='replaced'`, `replaced_by_bridge_account_id=61720938`, pour qu'il disparaisse de la vue active sans toucher Bridge.
- Vérifier que le compte 61720938 (déjà actif côté Vapeclub) reste seul porteur de l'IBAN.
- Recompute des stats pour SAS Vapeclub.

### 7. Tests obligatoires

Deno tests sur edge functions :
- `bridge-accounts/get-accounts` avec `company_id` : un compte `excluded` n'est jamais dans `accounts`, et son solde n'est pas dans `totalBalance`.
- `bridge-accounts/get-accounts` sans `company_id` : retourne 400.
- `bridge-sync` : un lien `excluded` reste `excluded` après cycle complet.
- Dedup : nouveau `bridge_account_id` avec fingerprint fort hérite de `excluded` ; sans fingerprint fort, reste non assigné (jamais activé d'office).

Tests intégration légère (vitest) :
- Le hook qui alimente le dashboard et celui qui alimente les paramètres lisent tous deux la vue `company_active_bridge_accounts` pour les soldes.

## Détails techniques

Fichiers impactés :
- `supabase/functions/bridge-accounts/index.ts` : refonte action `get-accounts`, ajout `get-bridge-raw-accounts`.
- `supabase/functions/_shared/validation.ts` : schéma de la nouvelle action.
- `supabase/functions/bridge-sync/index.ts` : protections excluded + refactor dedup.
- Migration SQL :
  - Trigger `BEFORE UPDATE ON company_bridge_accounts` interdisant `excluded → active` sans reset explicite des champs d'exclusion.
  - Trigger `BEFORE INSERT ON company_bridge_accounts` rejetant la création d'un lien `active` si un autre lien `excluded` existe pour la même `(company_id, account_identity)` (force passage par UI de réintégration).
  - Update data Vapeclub.
- `src/components/dashboard/BankAccounts.tsx` : passer sur `company_active_bridge_accounts`, supprimer l'usage de `bridge-accounts/get-accounts`.
- `src/components/settings/BankAccountsCard.tsx` : charger les exclus, ajouter section "Comptes masqués", action "Réintégrer" qui appelle l'API en remettant `status='active'` + `excluded_at/by/reason=NULL`.
- `src/components/settings/ManageAccountsDialog.tsx` : retiré.

## Résultat attendu

Même si Bridge continue de renvoyer ces comptes : Qashflow ne les affiche plus, ne les compte plus dans les soldes, et ne synchronise plus leurs transactions pour SAS Vapeclub. Le test API garantit qu'aucune régression future ne ré-ouvrira le contournement.