
# Plan : Gestion des déconnexions bancaires Bridge

## Objectif
Afficher clairement quand une connexion bancaire nécessite une action (expiration, SCA, erreur) et permettre à l'utilisateur de la reconnecter facilement.

---

## Étape 1 : Ajouter les champs de statut d'Item

**Migration SQL :**
- Ajouter `item_status` (text) : statut de la connexion bancaire (`ok`, `needs_action`, `error`, `deleted`)
- Ajouter `item_status_message` (text) : message d'erreur Bridge le cas échéant
- Ajouter `item_status_updated_at` (timestamp) : dernière mise à jour du statut

```text
┌────────────────────────────────────────────────────────┐
│                   bridge_accounts                       │
├────────────────────────────────────────────────────────┤
│ + item_status         │ text   │ 'ok' par défaut       │
│ + item_status_message │ text   │ nullable              │
│ + item_status_updated_at │ timestamptz │ nullable      │
└────────────────────────────────────────────────────────┘
```

---

## Étape 2 : Mettre à jour le webhook Bridge

Modifier `bridge-webhook/index.ts` pour :

1. **Gérer `item.refreshed`** avec le nouveau statut :
   - Stocker `content.status` dans `item_status`
   - Stocker `content.status_code_info` dans `item_status_message`
   
2. **Statuts Bridge à mapper :**
   - `0` → `ok` (tout va bien)
   - `402`, `429`, etc. → `needs_action` (SCA requise)
   - Autres codes erreur → `error`

---

## Étape 3 : Afficher l'indicateur de statut

### Dans BankAccountsCard.tsx (Paramètres)
- Badge coloré à côté de chaque groupe de banque :
  - 🟢 Vert : `ok`
  - 🟠 Orange : `needs_action` → "Action requise"
  - 🔴 Rouge : `error` → "Erreur de connexion"
  
- Bouton **"Reconnecter"** visible uniquement si `needs_action` ou `error`

### Dans BankAccounts.tsx (Dashboard)  
- Alerte en haut si une banque nécessite une action
- Badge sur le header "⚠️ 1 banque déconnectée"

---

## Étape 4 : Action de reconnexion

Créer une fonction `handleReconnect(bridgeItemId)` :
1. Appeler `bridge-connect` avec le paramètre `manage: true` pour ouvrir la session de gestion Bridge (pas une nouvelle connexion)
2. L'utilisateur peut alors mettre à jour ses identifiants ou valider le SCA
3. Au retour, synchroniser automatiquement

---

## Étape 5 : Sync du statut lors des synchronisations

Modifier `bridge-sync/index.ts` :
- Après avoir récupéré les comptes, appeler l'API Bridge `/items` pour récupérer le statut de chaque item
- Mettre à jour `item_status` en base de données

---

## Interface finale (maquette)

```text
┌─────────────────────────────────────────────────────────────┐
│ 🏦 Comptes bancaires                    [+ Ajouter] [🔄]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ▼ Qonto                                         🟢 Connecté │
│   ├── Compte principal         12 345,67 €                 │
│   └── Compte épargne            5 000,00 €                 │
│                                                             │
│ ▼ CIC                            🟠 Action requise [Reconnecter]
│   └── Compte Courant E...       8 234,12 €                 │
│       ⚠️ Votre banque nécessite une authentification       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `supabase/migrations/` | Nouveau fichier migration (ajout colonnes) |
| `supabase/functions/bridge-webhook/index.ts` | Gérer item.refreshed avec statut |
| `supabase/functions/bridge-sync/index.ts` | Récupérer et stocker statut des items |
| `supabase/functions/_shared/bridge-client.ts` | Ajouter méthode `fetchItems()` |
| `src/components/settings/BankAccountsCard.tsx` | Afficher badges + bouton Reconnecter |
| `src/components/dashboard/BankAccounts.tsx` | Alerte si banque déconnectée |

---

## Détails techniques

### API Bridge pour les Items
```typescript
// Récupérer les items (connexions bancaires)
GET /aggregation/items
→ Retourne les items avec leur status et status_code_info

// Exemple de réponse
{
  "resources": [{
    "id": 123,
    "status": 0,              // 0 = ok, autre = problème
    "status_code_info": null  // ou message d'erreur
  }]
}
```

### Session Manage vs Connect
- `bridge-connect` avec `prefill_email` → nouvelle connexion
- `bridge-connect` avec `item_id` → gérer/reconnecter une connexion existante

