## Objectif

Ajouter sur la page **/groupe** un bouton "Actualiser les soldes" qui force Bridge à re-contacter les banques de toutes les sociétés du groupe, puis relit les soldes à jour. Sans toucher aux transactions, sans risque de saturation, avec cooldown.

## Cause racine du problème

Aujourd'hui, les soldes affichés viennent de `bridge_accounts.balance`, mis à jour par :
- le webhook Bridge (quand Bridge décide de sync avec la banque, ~1-4×/jour)
- nos appels `get-accounts` qui ne font que **relire le cache Bridge**

Personne ne déclenche jamais `POST /v3/aggregation/items/{item_id}/refresh`, le seul endpoint qui force Bridge à re-contacter la banque maintenant. D'où la sensation "solde du matin".

## Architecture proposée (réutilisable, propre, scalable)

### Couche 1 — `BridgeClient` (`supabase/functions/_shared/bridge-client.ts`)

Ajouter 2 méthodes génériques (utilisables aussi par d'autres flows futurs) :

- `refreshItem(itemId: number): Promise<{ ok: boolean; status: number }>` — appelle `POST /v3/aggregation/items/{item_id}/refresh`
- `refreshAllItems(): Promise<{ refreshed: number; skipped: number; errors: number }>` — itère sur `fetchAllItems()`, refresh ceux dont `status === 0` (ok), skip les `needs_action`/`error`/`deleted`. Parallélisation via `Promise.allSettled`.

### Couche 2 — Nouvelle edge function `bridge-refresh-balances`

Endpoint dédié, scope soldes uniquement, **pas de sync transactions** :

```
POST bridge-refresh-balances
body: { company_ids: uuid[] }
```

Logique :
1. Auth user + check `has_company_access` pour chaque company_id
2. Pour chaque company → récupérer son `bridge_user_uuid`
3. **Dédoublonnage** : grouper par `bridge_user_uuid` (un user Bridge peut couvrir plusieurs sociétés)
4. Pour chaque user Bridge unique → `bridgeClient.refreshAllItems()`
5. Attendre ~4s (`await new Promise(r => setTimeout(r, 4000))`)
6. Pour chaque user Bridge → `fetchAllAccounts()` et upsert dans `bridge_accounts` (le trigger DB `recompute_company_bank_stats` fait le reste)
7. Renvoyer `{ refreshed_items, refreshed_accounts, companies_updated }`

Pourquoi une nouvelle function et pas étendre `bridge-accounts` ? Parce que c'est une opération multi-société, multi-bridge-user, avec scope clair "refresh + relecture soldes". Ça mérite son propre endpoint testable.

### Couche 3 — Hook front `useGroupRefreshBalances`

Nouveau hook dans `src/hooks/useGroupRefreshBalances.ts` :

```ts
{
  refresh: () => Promise<void>,
  isRefreshing: boolean,
  cooldownRemainingMs: number,  // 0 si dispo
  lastRefreshAt: Date | null,
}
```

- Cooldown 5 min via `localStorage` clé `group_last_manual_refresh`
- Invalide les queries `['group_balances']` et `['bank_balance']` après succès
- Toast succès : *"Synchro déclenchée auprès de vos banques. Les nouveaux soldes peuvent prendre 1 à 2 minutes."*
- Toast cooldown : *"Synchro déjà déclenchée il y a moins de 5 minutes."*
- Toast erreur partielle : *"X banque(s) n'ont pas pu être actualisées."*

### Couche 4 — UI `GroupOverview.tsx`

Bouton dans le header (à côté de `PageHeader`) :
- Icône `RefreshCw` + label "Actualiser les soldes"
- Spinner + désactivé pendant `isRefreshing`
- Tooltip pendant cooldown : *"Disponible dans Xm Ys"*
- Sous-texte discret sous le hero card : *"Dernière actualisation manuelle : il y a Xmin"* (si `lastRefreshAt`)

## Fichiers touchés

- `supabase/functions/_shared/bridge-client.ts` — `refreshItem` + `refreshAllItems`
- `supabase/functions/bridge-refresh-balances/index.ts` — nouvelle edge function
- `supabase/functions/_shared/validation.ts` — schéma Zod du body
- `src/hooks/useGroupRefreshBalances.ts` — nouveau hook
- `src/pages/GroupOverview.tsx` — bouton + sous-texte
- `supabase/functions/_shared/tests/bridge-client.test.ts` — test `refreshItem` (mock fetch)

## Garde-fous anti-bazar

| Risque | Mitigation |
|---|---|
| Spam clic | Cooldown 5 min localStorage |
| Rate limit Bridge | Refresh dédoublonné par `bridge_user_uuid`, pas par société |
| Surcharge DB | Pas de full-sync transactions, juste upsert `bridge_accounts` (trigger recompute déjà optimisé) |
| Promesse trompeuse | Toast explicite "1 à 2 minutes" |
| Items HS | Skip silencieux des items en erreur, comptés dans le retour |
| Timeout edge function | `Promise.allSettled`, pas de `Promise.all` qui kill au premier échec |

## Hors scope (volontairement)

- Pas de bouton refresh par société individuelle (déjà sur Dashboard via `BankAccounts.tsx`, qu'on traitera après si besoin avec la même API)
- Pas de webhook custom — le webhook Bridge existant fera son job en parallèle si la banque répond
- Pas de stockage `last_manual_refresh_at` en DB — pas nécessaire pour un cooldown UX

## Question avant de coder

Le cooldown : je pars sur **5 minutes localStorage**. Tu préfères :
- **5 min** (raisonnable, évite le spam, suffisant pour Bridge propager)
- **2 min** (plus permissif)  
- **Pas de cooldown** mais bouton désactivé pendant la requête uniquement