

# Correction Critique : Isolation Hermétique des Flux Bancaires

## Diagnostic

### Problème Identifié
Les comptes bancaires **non assignés** dans `company_bridge_accounts` ont leurs transactions qui "fuient" vers les sociétés qui déclenchent la synchronisation. C'est une violation grave de l'isolation des données.

### Cause Racine (bridge-sync/index.ts ligne 167)
```typescript
// LE BUG
const correctCompanyId = accountToCompanyMap[transaction.account_id] || companyId;
//                                                                   ^^^^^^^^^^^
// Si pas de mapping → fallback vers la société qui sync = FUITE DE DONNÉES
```

### Impact Actuel
| Compte non assigné | Transactions concernées | Sociétés polluées |
|-------------------|------------------------|-------------------|
| C/C PRO Global E-Fumeur Nantes | 1491 | 2 (doublons) |
| SAS Immoflix | 287 | 1 |
| Fridaflix | 157 | 1 |
| Visabusiness M Flatres Jean-Paul | 30 | 2 (doublons) |
| Compte Courant Entreprise EUR SAS Immoflix | 49 | 2 (doublons) |
| Coachflix - Épargne | 13 | 1 |
| Immoflix | 12 | 1 |

**Total : ~2700+ transactions mal assignées ou dupliquées**

---

## Solution : Politique de Sécurité "Pas d'Assignation = Pas de Sync"

### Principe
Si un compte bancaire n'est **pas explicitement assigné** à une société dans `company_bridge_accounts`, ses transactions **NE DOIVENT PAS être importées**.

### Modifications

#### 1. Edge Function bridge-sync (Partie critique)

```typescript
// AVANT (ligne 167)
const correctCompanyId = accountToCompanyMap[transaction.account_id] || companyId;

// APRÈS - Ignorer les transactions de comptes non assignés
if (!accountToCompanyMap[transaction.account_id]) {
  // Compte non assigné → on IGNORE cette transaction
  console.info(`[bridge-sync] Skipping transaction from unassigned account ${transaction.account_id}`);
  continue; // Passer à la transaction suivante
}
const correctCompanyId = accountToCompanyMap[transaction.account_id];
```

#### 2. Migration SQL : Nettoyage des données polluées

```sql
-- Supprimer les transactions de comptes non assignés
DELETE FROM transactions t
WHERE t.source = 'bridge'
  AND NOT EXISTS (
    SELECT 1 
    FROM bridge_accounts ba
    JOIN company_bridge_accounts cba ON cba.bridge_account_id = ba.bridge_account_id
    WHERE ba.name = t.bank_account_name
      AND cba.company_id = t.company_id
  );
```

Cette requête supprime uniquement les transactions où :
- La source est 'bridge'
- Le compte bancaire (via son nom) n'est PAS assigné à la société de la transaction

---

## Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `supabase/functions/bridge-sync/index.ts` | Ignorer les transactions de comptes non assignés (ligne 167) |
| Migration SQL | Nettoyer les transactions existantes mal assignées |

---

## Flux Corrigé

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Synchronisation Bridge - NOUVEAU COMPORTEMENT                          │
├─────────────────────────────────────────────────────────────────────────┤
│ Pour chaque transaction :                                              │
│                                                                         │
│   1. Chercher account_id dans accountToCompanyMap                      │
│                                                                         │
│   2. SI trouvé → assigner à la société mappée                          │
│                                                                         │
│   3. SI NON trouvé → IGNORER la transaction (skip)                     │
│      ⚠️ Log: "Skipping transaction from unassigned account"            │
│                                                                         │
│   ❌ PLUS DE FALLBACK vers la société qui sync                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sécurité Renforcée

| Niveau | Mécanisme |
|--------|-----------|
| Edge Function | Transactions ignorées si compte non assigné |
| Base de données | Nettoyage des données polluées existantes |
| Interface | L'utilisateur voit uniquement les comptes assignés à sa société |

---

## Bénéfices

1. **Isolation hermétique** : Aucune fuite de données entre sociétés
2. **Pas de doublons** : Une transaction n'existe que dans une seule société
3. **Contrôle explicite** : L'utilisateur doit assigner un compte pour voir ses transactions
4. **Données propres** : Suppression des ~2700 transactions mal assignées

