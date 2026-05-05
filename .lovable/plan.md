## Diagnostic — pourquoi ces "comptes faux" reviennent

J'ai inspecté la base. Pour `SAS Vapeclub` (seule société rattachée à `bridge_user_uuid d20d4144…`), Bridge expose **8 comptes** répartis sur **4 connexions bancaires (items)** différentes :

```
item 12629299 → Compte De Chèques ****2761  (-1 513,98 €)   non-assigné
item 12629299 → Compte De Chèques ****9269  (-15 858,70 €)  non-assigné
item 12868903 → Compte Courant Entreprise EUR Vapeclub  (CIC)        assigné
item 12868928 → SAS Vapeclub                            (Banque pop) assigné
item 12868928 → Vapeclub Xx6195                         (Banque pop) assigné
item 12873433 → Compte Cheques 1  IBAN ...4046  (Autre banque, 2 096,62 €) assigné
item 12873433 → Compte Cheques 1  IBAN ...4072  (Autre banque, 7 262,81 €) assigné
item 12873936 → Compte Cheques 1  IBAN ...4072  (sans bank_name, 7 262,81 €) non-assigné  ← doublon de connexion
```

Deux problèmes structurels expliquent ce que tu vois :

1. **Connexions Bridge dupliquées.** L'item `12873936` est une **reconnexion** du même compte que `12873433` (même IBAN `…4072`, même solde). À chaque reconnexion via le Connect, Bridge crée un nouvel `item_id` au lieu de réutiliser l'ancien, ce qui produit des doublons de `bridge_accounts` côté base.

2. **L'auto-assignation est têtue.** Dans `bridge-sync` (lignes 712-742), tant qu'une société est seule sur un `bridge_user_uuid`, **tous les comptes non-assignés sont ré-attachés automatiquement à chaque sync**. C'est pour ça que la suppression manuelle de `company_bridge_accounts` que j'ai faite hier est revenue : la sync suivante les a recréés. → "Y'a rien de dynamique" → exact, par design.

3. Le composant `Dashboard` a sa propre lecture directe `company_bridge_accounts → bridge_accounts` (hook local `useAssignedAccounts`), donc tout ce qui est assigné s'affiche dans la pastille "Solde total", sans aucun filtre utilisateur possible.

Ce n'est donc pas un bug d'affichage : c'est un manque d'**exclusion persistante** côté domaine.

## Ce que je propose (cause racine, pas patch)

### A. Introduire un état "ignoré" persistant au niveau du compte Bridge
Ajouter une colonne `is_ignored boolean default false` sur `bridge_accounts`. C'est l'équivalent de ce qui existe déjà pour les transactions (`is_ignored`) — même convention, même vocabulaire.

Règles :
- Un compte `is_ignored = true` est **invisible partout** : dashboard, group balances, useDashboardStats, useBankBalance, useGroupBalances, ManageAccountsDialog (badge "Ignoré").
- Il **ne participe à aucun calcul** : solde total société, solde consolidé groupe, snapshots, forecasts ledger.
- L'auto-assign de `bridge-sync` doit **respecter** ce flag : ne JAMAIS ré-assigner un compte ignoré et ne pas considérer son absence d'assignation comme une anomalie à corriger.
- Désactivable à tout moment depuis l'UI.

### B. Déduplication sur reconnexion (cause racine du doublon `…4072`)
Quand `syncBridgeAccounts` upserte les comptes, détecter qu'un nouveau `bridge_account_id` correspond à un compte existant **même IBAN, même `bridge_user_uuid`** sur un item différent.
- Marquer l'**ancien** `bridge_account_id` comme `status = 'replaced'` + `is_ignored = true`.
- Re-mapper son assignation (`company_bridge_accounts`) vers le nouveau.
- Re-mapper ses transactions (`transactions.bridge_account_id`) vers le nouveau pour ne pas perdre l'historique.

Cela règle définitivement le cas "Compte Cheques 1 apparaît deux fois après reconnexion".

### C. UI dynamique sur le Dashboard
Dans la pastille "Solde total" :
- Ajouter un menu contextuel (icône `…` au survol de chaque ligne) : **Masquer ce compte**.
- Action → marque `is_ignored = true` côté DB → invalidation des queries → disparaît immédiatement, et reste masqué après resync.
- Dans `Paramètres → Comptes bancaires`, une section "Comptes masqués" permet de les réafficher.

### D. Nettoyage des données existantes pour Vapeclub (one-shot dans la migration)
- Marquer `is_ignored = true` sur l'item dupliqué `12873936` (compte `61723202`).
- Marquer `is_ignored = true` sur les deux comptes "Compte De Chèques ****2761/9269" de l'item `12629299` (orphelins de l'ancienne connexion CDN, soldes négatifs invraisemblables, pas assignés).
- Conserver les 5 autres comptes assignés tels quels — tu pourras en masquer d'autres via l'UI si besoin.

## Détails techniques

**Migration**
```sql
ALTER TABLE bridge_accounts
  ADD COLUMN is_ignored boolean NOT NULL DEFAULT false;
CREATE INDEX idx_bridge_accounts_active
  ON bridge_accounts (bridge_user_uuid)
  WHERE is_ignored = false;
-- Nettoyage Vapeclub
UPDATE bridge_accounts SET is_ignored = true
 WHERE bridge_account_id IN (61723202, 60568536, 60568535);
DELETE FROM company_bridge_accounts
 WHERE bridge_account_id IN (61723202, 60568536, 60568535);
```

**Edge functions à mettre à jour**
- `supabase/functions/bridge-sync/index.ts` : auto-assign (l. 712-742) ignore les comptes `is_ignored`. Ajouter étape de déduplication par IBAN avant upsert.
- `supabase/functions/bridge-accounts/index.ts` : exclure `is_ignored` du retour `accounts` et du `total_balance`.
- `supabase/functions/snapshot-balances/index.ts` : exclure `is_ignored`.

**Hooks frontend à mettre à jour** (filtre `is_ignored = false`)
- `useGroupBalances.ts`
- `useDashboardStats.ts` (calcul currentBalance via `bridge_accounts`)
- `useBankBalance.ts`
- `Dashboard.tsx` `useAssignedAccounts`
- `ManageAccountsDialog.tsx` (badge + filtre par défaut, switch "afficher les masqués")
- `BankAccounts.tsx` (composant Settings)

**Nouveau composant léger**
- Menu contextuel sur chaque ligne du Solde total (`DropdownMenu` shadcn déjà dispo) → action `toggleIgnored(bridge_account_id)`.

**Tests / non-régression**
- Vérifier que `useBankBalance` et `useDashboardStats` retournent la même valeur après masquage.
- Vérifier que la sync suivante ne réactive pas l'assignation.
- Vérifier que `forecasts` ledger (point zéro) reste cohérent : recompute après masquage.

## Ce que tu obtiendras
- Plus jamais de comptes "fantômes" qui reviennent après une sync.
- Capacité de masquer un compte d'un clic depuis le dashboard.
- Déduplication automatique des reconnexions Bridge (cas générique, pas patch Vapeclub).
- Cohérence garantie entre dashboard, groupe et forecasts.