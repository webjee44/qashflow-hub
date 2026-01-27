
# Plan d'Optimisation Bridge API avec Webhooks

## Objectif
Passer d'une architecture de **polling** (synchronisation périodique de tous les comptes) à une architecture **event-driven** (mise à jour uniquement quand Bridge notifie un changement), pour supporter 50+ comptes bancaires avec une latence minimale et une charge API réduite de 90%.

---

## Architecture Actuelle vs Proposée

```text
AVANT (Polling)                          APRES (Event-Driven)
─────────────────                        ────────────────────
┌─────────────┐                          ┌─────────────┐
│   Frontend  │                          │   Frontend  │
│ (manual sync)│                         │ (realtime)  │
└──────┬──────┘                          └──────┬──────┘
       │                                        │ Supabase Realtime
       ▼                                        │
┌─────────────┐                          ┌─────────────┐
│ bridge-sync │ ◄─── Cron toutes les    │ bridge-sync │ ◄─── A la demande
│ (full-sync) │      15min (O(n))       │ (full-sync) │      (init only)
└──────┬──────┘                          └──────┬──────┘
       │                                        │
       ▼                                        │
┌─────────────┐                          ┌─────────────────────────┐
│  Bridge API │ ◄─── Fetch ALL          │   bridge-webhook        │
│ (90 jours)  │      transactions       │   (nouvelle fonction)   │
└─────────────┘                          └───────────┬─────────────┘
                                                     │
                                         ┌───────────▼─────────────┐
                                         │      Bridge API         │
                                         │  webhook: item.account  │
                                         │  .updated/.created      │
                                         └─────────────────────────┘
```

---

## Composants Techniques

### 1. Nouvelle Edge Function: `bridge-webhook`

**Responsabilités:**
- Recevoir les webhooks Bridge (endpoint public)
- Valider la signature HMAC-SHA256
- Router les événements vers les handlers appropriés
- Traiter les événements en background (non-bloquant)

**Événements supportés:**

| Événement | Action |
|-----------|--------|
| `item.account.updated` | Sync incrémental des transactions du compte |
| `item.account.created` | Ajout du nouveau compte + sync initial |
| `item.account.deleted` | Marquage soft-delete des transactions |
| `item.refreshed` | Mise à jour du statut de l'item (erreurs, expiration auth) |
| `item.deleted` | Nettoyage des données associées |

**Payload `item.account.updated` (le plus important):**
```json
{
  "content": {
    "account_id": 22908770,
    "balance": 1678.12,
    "item_id": 4568477,
    "nb_new_transactions": 15,
    "nb_deleted_transactions": 0,
    "nb_updated_transactions": 0,
    "user_uuid": "766b2f5d-..."
  },
  "type": "item.account.updated"
}
```

### 2. Nouveau Secret: `BRIDGE_WEBHOOK_SECRET`

Le secret HMAC fourni par Bridge lors de la création du webhook, utilisé pour valider les signatures.

### 3. Nouvelle Table: `bridge_accounts`

Pour mapper les `account_id` Bridge aux `company_id` internes et stocker les métadonnées par compte.

```sql
CREATE TABLE bridge_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  bridge_account_id INTEGER NOT NULL UNIQUE,
  bridge_item_id INTEGER NOT NULL,
  bridge_user_uuid TEXT NOT NULL,
  name TEXT,
  iban TEXT,
  balance NUMERIC DEFAULT 0,
  account_type TEXT,
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bridge_accounts_company ON bridge_accounts(company_id);
CREATE INDEX idx_bridge_accounts_user_uuid ON bridge_accounts(bridge_user_uuid);
```

### 4. Table de Queue Optionnelle: `bridge_sync_queue`

Pour gérer les syncs en arrière-plan avec retry automatique.

```sql
CREATE TABLE bridge_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_account_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);
```

### 5. Mise à jour du `bridge-sync` existant

Ajouter une nouvelle action `incremental-sync` pour synchroniser uniquement les nouvelles transactions d'un compte spécifique :

```typescript
// Nouvelle action: incremental-sync
if (action === 'incremental-sync') {
  // Sync uniquement les transactions depuis last_sync_at
  // Utilise since= pour ne pas refetch l'historique complet
}
```

### 6. Optimisation: Batch Insert

Remplacer les insertions transaction par transaction par des upserts batch :

```typescript
// AVANT: O(n) requêtes DB
for (const transaction of transactions) {
  await supabaseAdmin.from('transactions').insert(...)
}

// APRES: O(1) requête DB
const upsertData = transactions.map(t => ({...}));
await supabaseAdmin.from('transactions').upsert(upsertData, {
  onConflict: 'pennylane_id'
});
```

---

## Sécurité du Webhook

### Validation de Signature HMAC-SHA256

```typescript
function verifyBridgeSignature(
  payload: string, 
  signatureHeader: string, 
  secret: string
): boolean {
  // Extraire les signatures v1=XXX,v1=YYY
  const signatures = signatureHeader
    .split(',')
    .filter(s => s.startsWith('v1='))
    .map(s => s.slice(3));
  
  // Calculer le hash attendu
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  const expectedSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  
  // Comparer (timing-safe)
  return signatures.includes(expectedSignature);
}
```

### Whitelist des IPs Bridge (optionnel)

Bridge envoie ses webhooks depuis ces IPs fixes :
- `63.32.31.5`
- `52.215.247.62`
- `34.249.92.209`

---

## Notifications Temps Réel (Frontend)

Utiliser Supabase Realtime pour notifier le frontend quand de nouvelles transactions arrivent :

```sql
-- Activer realtime sur transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
```

```typescript
// Frontend: écouter les nouvelles transactions
supabase
  .channel('transactions')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'transactions',
    filter: `company_id=eq.${companyId}`
  }, (payload) => {
    toast.info('Nouvelle transaction', {
      description: payload.new.description
    });
    refetchTransactions();
  })
  .subscribe();
```

---

## Configuration Bridge Dashboard

Dans le dashboard Bridge, créer un webhook avec :

**URL de callback:**
```
https://slllsekdepfnlcapcgex.supabase.co/functions/v1/bridge-webhook
```

**Événements à activer:**
- `item.account.updated` (priorité haute)
- `item.account.created`
- `item.account.deleted`
- `item.refreshed`
- `item.deleted`

---

## Diagramme de Séquence: Sync Incrémental

```text
Bridge Scheduler    Bridge API       Webhook Endpoint       Database
      │                 │                   │                   │
      │ Refresh item    │                   │                   │
      │────────────────>│                   │                   │
      │                 │                   │                   │
      │                 │ item.account      │                   │
      │                 │ .updated          │                   │
      │                 │──────────────────>│                   │
      │                 │                   │                   │
      │                 │                   │ Validate signature│
      │                 │                   │                   │
      │                 │                   │ Get company by    │
      │                 │                   │ user_uuid         │
      │                 │                   │──────────────────>│
      │                 │                   │                   │
      │                 │   GET /transactions                   │
      │                 │   ?account_id=X&since=last_sync       │
      │                 │<──────────────────│                   │
      │                 │                   │                   │
      │                 │   15 new txns     │                   │
      │                 │──────────────────>│                   │
      │                 │                   │                   │
      │                 │                   │ Batch upsert      │
      │                 │                   │──────────────────>│
      │                 │                   │                   │
      │                 │   200 OK          │   Realtime push   │
      │                 │<──────────────────│<──────────────────│
```

---

## Gains de Performance Attendus

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Appels API Bridge/jour (50 comptes) | ~4800 (cron 15min) | ~50-100 (événements) | -98% |
| Latence détection nouvelle transaction | 0-15 min | < 1 min | -93% |
| Transactions fetchées par sync | Toutes (90j) | Uniquement nouvelles | -95% |
| Requêtes DB par sync | O(n) par transaction | O(1) batch | -90% |
| Charge serveur | Pics réguliers | Événementiel lissé | Stable |

---

## Étapes d'Implémentation

### Phase 1 - Infrastructure (1 session)
1. Ajouter le secret `BRIDGE_WEBHOOK_SECRET`
2. Créer la migration pour `bridge_accounts` et `bridge_sync_queue`
3. Créer l'edge function `bridge-webhook` avec validation de signature

### Phase 2 - Logique de Sync (1 session)
4. Implémenter le handler `item.account.updated` avec sync incrémental
5. Implémenter les handlers pour les autres événements
6. Optimiser `bridge-sync` avec batch upserts

### Phase 3 - Frontend & Realtime (1 session)
7. Activer Supabase Realtime sur `transactions`
8. Ajouter les listeners côté frontend
9. Indicateur de statut de connexion Bridge en temps réel

### Phase 4 - Configuration & Test
10. Configurer le webhook dans le dashboard Bridge
11. Tester avec `TEST_EVENT`
12. Monitoring et logs

---

## Points d'Attention

- **Idempotence**: Chaque événement doit pouvoir être rejoué sans effet de bord (upsert vs insert)
- **Retry**: Bridge retente automatiquement les webhooks en échec (5xx)
- **Ordre**: Les événements peuvent arriver dans le désordre → utiliser les timestamps
- **Timeout**: Bridge attend 30s max pour une réponse → utiliser `waitUntil()` pour le background processing
