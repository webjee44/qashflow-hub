
# Plan de Correction : Comptes bancaires par société

## Problème identifié

L'edge function `bridge-sync` écrase les valeurs `bridge_accounts_count` et `bank_balance` de chaque société avec **tous** les comptes Bridge synchronisés, au lieu de respecter les assignations faites par l'utilisateur dans `company_bridge_accounts`.

### Flux actuel (incorrect)
1. Vous assignez 1 compte à "E-Fumeur Internet" via l'interface
2. `ManageAccountsDialog` met correctement `bridge_accounts_count: 1` et `bank_balance: 60 404,40 €`
3. La synchronisation (`bridge-sync`) s'exécute et **écrase** avec tous les 15 comptes et 260 508,13 €

### Flux attendu (corrigé)
1. Vous assignez 1 compte via l'interface
2. La synchronisation respecte les assignations et ne met à jour que les comptes assignés

---

## Solution technique

### 1. Modifier `bridge-sync/index.ts`

Pour les deux actions concernées (`cron-sync` et `sync-accounts`/`full-sync`), remplacer le calcul actuel par :

**Avant (lignes 228-235 et 313-320) :**
```typescript
await supabaseAdmin
  .from('companies')
  .update({ 
    bank_balance: totalBalance,
    bank_balance_updated_at: new Date().toISOString(),
    bridge_accounts_count: allAccounts.length  // TOUS les comptes
  })
  .eq('id', company_id);
```

**Après :**
```typescript
// 1. Récupérer les assignations existantes pour cette société
const { data: assignedAccounts } = await supabaseAdmin
  .from('company_bridge_accounts')
  .select('bridge_account_id')
  .eq('company_id', company_id);

// 2. Calculer le solde et le nombre uniquement des comptes assignés
const assignedAccountIds = new Set(assignedAccounts?.map(a => a.bridge_account_id) || []);
const filteredAccounts = allAccounts.filter(a => assignedAccountIds.has(a.id));
const assignedBalance = filteredAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

// 3. Mettre à jour avec les bonnes valeurs
await supabaseAdmin
  .from('companies')
  .update({ 
    bank_balance: assignedBalance,
    bank_balance_updated_at: new Date().toISOString(),
    bridge_accounts_count: filteredAccounts.length
  })
  .eq('id', company_id);
```

### 2. Gérer le cas "aucune assignation explicite"

Si l'utilisateur n'a jamais configuré de comptes (`company_bridge_accounts` vide pour cette société), deux options :
- **Option A** : Afficher 0 comptes et 0 € (forcer l'utilisateur à configurer)
- **Option B** : Considérer tous les comptes comme assignés par défaut (comportement actuel)

Je recommande **Option A** pour plus de clarté et cohérence.

### 3. Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `supabase/functions/bridge-sync/index.ts` | Filtrer les comptes par `company_bridge_accounts` avant calcul |

---

## Comportement après correction

| Société | Comptes assignés | Solde affiché |
|---------|------------------|---------------|
| E-Fumeur Internet | 1 (Compte Principal) | 60 404,40 € |
| Autres sociétés | 0 (non configurés) | 0 € |

L'utilisateur devra assigner les comptes aux bonnes sociétés via l'onglet "Comptes bancaires" pour voir les bons totaux.
