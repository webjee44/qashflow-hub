
# Correction de l'Isolation des Transactions par Société

## Problème Identifié

Le système a une faille majeure dans l'isolation des données :

| Élément | État Actuel | État Souhaité |
|---------|-------------|---------------|
| Transactions | Assignées à la société qui possède `bridge_user_uuid` | Assignées à la société dont le compte bancaire est dans `company_bridge_accounts` |
| Filtrage Dashboard | Inclut transactions avec `company_id = null` | Strictement `company_id = société sélectionnée` |
| Filtrage /transactions | Filtre strict (correct) | Correct |

## Cause Racine

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Connexion Bridge unique (bridge_user_uuid) → E-fumeur                   │
│                                                                         │
│ Comptes bancaires Bridge :                                              │
│   • Compte 59339981 → Assigné à Cloud Vapor                             │
│   • Compte 59339667 → Assigné à Cloud Vapor                             │
│   • Compte 59339669 → Assigné à E-fumeur                                │
│   • Compte 59339375 → Assigné à E-fumeur                                │
│                                                                         │
│ PROBLÈME : bridge-sync/index.ts assigne TOUTES les transactions        │
│ à company_id = E-fumeur (qui a le bridge_user_uuid)                     │
│ au lieu de regarder company_bridge_accounts                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Solution en 2 Parties

### Partie 1 : Corriger bridge-sync (Edge Function)

Modifier `syncCompanyTransactions` pour assigner les transactions à la bonne société basée sur le compte bancaire :

```typescript
// AVANT (ligne 156-157)
company_id: companyId, // Toujours la même société

// APRÈS
// 1. Récupérer la map compte → société
const accountToCompanyMap = await getAccountToCompanyMap(supabaseAdmin, bridgeUserUuid);

// 2. Pour chaque transaction, trouver la bonne société
const correctCompanyId = accountToCompanyMap[transaction.account_id] || companyId;
company_id: correctCompanyId,
```

Nouvelle fonction helper :
```typescript
async function getAccountToCompanyMap(
  supabaseAdmin: any,
  bridgeUserUuid: string
): Promise<Record<number, string>> {
  // Récupérer tous les mappings compte → société
  const { data } = await supabaseAdmin
    .from('company_bridge_accounts')
    .select('bridge_account_id, company_id')
    .in('bridge_account_id', (
      await supabaseAdmin
        .from('bridge_accounts')
        .select('bridge_account_id')
        .eq('bridge_user_uuid', bridgeUserUuid)
    ).data?.map(a => a.bridge_account_id) || []);

  const map: Record<number, string> = {};
  for (const row of data || []) {
    map[row.bridge_account_id] = row.company_id;
  }
  return map;
}
```

### Partie 2 : Corriger les filtres Frontend

#### TransactionList.tsx (Dashboard)
```typescript
// AVANT (ligne 36)
query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);

// APRÈS - Filtre strict
query.eq('company_id', currentCompany.id);
```

### Partie 3 : Migrer les transactions existantes

Créer un script SQL pour réassigner les transactions aux bonnes sociétés basées sur les comptes bancaires :

```sql
-- Mettre à jour les transactions existantes vers la bonne société
UPDATE transactions t
SET company_id = cba.company_id
FROM bridge_accounts ba
JOIN company_bridge_accounts cba ON cba.bridge_account_id = ba.bridge_account_id
WHERE t.pennylane_id LIKE 'bridge_%'
  AND CAST(REPLACE(t.pennylane_id, 'bridge_', '') AS text) IN (
    SELECT CAST(bridge_account_id AS text) FROM bridge_accounts
  )
  AND t.bank_account_name = ba.name
  AND cba.company_id != t.company_id;
```

Alternative plus fiable : mapper via le nom du compte bancaire :
```sql
-- Réassigner les transactions E-fumeur vers Cloud Vapor si le compte appartient à Cloud Vapor
UPDATE transactions t
SET company_id = cba.company_id
FROM bridge_accounts ba
JOIN company_bridge_accounts cba ON cba.bridge_account_id = ba.bridge_account_id
WHERE t.bank_account_name = ba.name
  AND t.company_id != cba.company_id;
```

---

## Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `supabase/functions/bridge-sync/index.ts` | Ajouter lookup compte→société pour les transactions |
| `src/components/dashboard/TransactionList.tsx` | Supprimer le `OR company_id.is.null` |
| Migration SQL | Réassigner les transactions existantes |

---

## Flux Corrigé

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Synchronisation Bridge                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Récupérer toutes les transactions de tous les comptes               │
│ 2. Pour chaque transaction :                                           │
│    - Trouver account_id de la transaction                              │
│    - Chercher dans company_bridge_accounts quelle société              │
│      possède ce compte                                                 │
│    - Assigner company_id = société propriétaire                        │
│ 3. Si aucune société n'a le compte → assigner à la société "par défaut"│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sécurité Renforcée

Pour garantir l'étanchéité totale, le filtrage sera appliqué à tous les niveaux :

| Niveau | Mécanisme |
|--------|-----------|
| Base de données | RLS policy existante (transactions.company_id + has_company_access) |
| Edge Function | Attribution correcte lors de l'insertion |
| Frontend | Filtre strict sans fallback "null" |

---

## Impact

Après cette correction :
- Les transactions de chaque compte bancaire seront assignées à la société qui possède ce compte
- Le dashboard Cloud Vapor n'affichera que les transactions Cloud Vapor
- Les transactions existantes seront migrées vers leurs bonnes sociétés
