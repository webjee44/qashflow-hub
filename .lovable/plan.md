
# Plan : Connecteurs Comptables (Odoo 17 en premier)

## Vision

Remplacer le bouton "Sync Pennylane" par un système générique de connecteurs :
1. CTA "Connecteur Compta" 
2. Choix de la solution (Odoo, Pennylane, etc.)
3. Saisie des clés API par société
4. Synchronisation des factures

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      PAGE /creances - Header                             │
│                                                                          │
│  [+ Ajouter]   [⚙️ Connecteur Compta]                                    │
│                      ↓                                                   │
│               ┌──────────────────────┐                                   │
│               │  Sélectionnez votre  │                                   │
│               │  logiciel comptable  │                                   │
│               │                      │                                   │
│               │  ○ Odoo 17          │ ← Prioritaire                      │
│               │  ○ Pennylane         │ ← Existant                        │
│               │  ○ QuickBooks        │ ← Futur                           │
│               │                      │                                   │
│               │  [Configurer]        │                                   │
│               └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                   DIALOG : Configuration Odoo                            │
│                                                                          │
│  URL du serveur Odoo : [https://mycompany.odoo.com    ]                  │
│  Nom de la base     : [mydb                           ]                  │
│  Identifiant        : [admin@company.com              ]                  │
│  Clé API / Mot de passe : [••••••••••••••••••         ]                  │
│                                                                          │
│             [Tester la connexion]   [Enregistrer]                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                   STATUT CONNECTEUR (Header)                             │
│                                                                          │
│  Si configuré :                                                          │
│  [🔗 Odoo] [↻ Sync maintenant]   Dernière sync : il y a 2h               │
│                                                                          │
│  Si non configuré :                                                      │
│  [⚙️ Connecteur Compta]                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Etape 1 : Stockage des credentials

### Table existante : `company_secrets`

La table existe déjà avec les colonnes :
- `company_id` : uuid
- `secret_type` : text (ex: 'pennylane_api_key', 'odoo_url', 'odoo_db', etc.)
- `encrypted_value` : text

Pour Odoo, on stockera 4 secrets par société :
- `odoo_url` : URL du serveur Odoo
- `odoo_db` : Nom de la base de données
- `odoo_username` : Identifiant utilisateur
- `odoo_api_key` : Clé API ou mot de passe

---

## Etape 2 : Edge Function `accounting-connector-sync`

### Fonction générique

Une seule edge function qui :
1. Détecte le connecteur configuré pour la société
2. Appelle le bon provider (Odoo, Pennylane)
3. Synchronise les factures

### API Odoo 17 - Appels JSON-RPC

Odoo 17 utilise JSON-RPC pour l'API externe. Voici la logique :

**1. Authentification**
```javascript
// POST /jsonrpc
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "common",
    "method": "authenticate",
    "args": [db, username, password, {}]
  }
}
// Retourne: uid (user id)
```

**2. Récupération des factures clients (créances)**
```javascript
// Modèle: account.move
// Filtre: move_type = 'out_invoice' (facture client)
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "object",
    "method": "execute_kw",
    "args": [
      db, uid, password,
      "account.move",
      "search_read",
      [[["move_type", "=", "out_invoice"], ["state", "=", "posted"]]],
      {
        "fields": ["name", "partner_id", "invoice_date", "invoice_date_due", 
                   "amount_untaxed", "amount_total", "amount_tax", 
                   "payment_state", "state"]
      }
    ]
  }
}
```

**3. Récupération des factures fournisseurs (dettes)**
```javascript
// Filtre: move_type = 'in_invoice' (facture fournisseur)
[[["move_type", "=", "in_invoice"], ["state", "=", "posted"]]]
```

### Mapping Odoo -> Table invoices

| Champ Odoo | Champ invoices | Notes |
|------------|----------------|-------|
| `name` | `invoice_number` | Ex: "INV/2025/0001" |
| `partner_id[1]` | `partner_name` | Nom du partenaire |
| `invoice_date` | `invoice_date` | Date d'émission |
| `invoice_date_due` | `due_date` | Date d'échéance |
| `amount_untaxed` | `amount_ht` | Montant HT |
| `amount_total` | `amount_ttc` | Montant TTC |
| `amount_tax` | `vat_amount` | TVA |
| `payment_state` | `status` | 'paid' / 'not_paid' / 'partial' |
| `move_type` | `type` | 'out_invoice' -> 'receivable', 'in_invoice' -> 'payable' |
| `id` | `external_id` | ID Odoo pour éviter doublons |

---

## Etape 3 : Interface - Composants

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `src/components/invoices/ConnectorDialog.tsx` | Dialog principal de configuration |
| `src/components/invoices/OdooConfigForm.tsx` | Formulaire spécifique Odoo |
| `src/components/invoices/ConnectorStatus.tsx` | Badge statut + bouton sync |
| `src/hooks/useAccountingConnector.ts` | Hook pour gérer les connecteurs |
| `supabase/functions/accounting-connector-sync/index.ts` | Edge function de sync |

### ConnectorDialog.tsx

Dialog en deux étapes :
1. **Sélection du provider** : liste des connecteurs disponibles
2. **Configuration** : formulaire spécifique au provider sélectionné

### OdooConfigForm.tsx

Champs du formulaire :
- URL Odoo (ex: https://mycompany.odoo.com)
- Base de données
- Identifiant (email)
- Clé API (ou mot de passe)
- Bouton "Tester la connexion"

### ConnectorStatus.tsx

Affiche le statut :
- Si configuré : badge avec nom du provider + bouton sync
- Si non configuré : CTA "Connecteur Compta"

---

## Etape 4 : Flow utilisateur

1. L'utilisateur clique sur "Connecteur Compta"
2. Il choisit Odoo dans la liste
3. Il saisit ses credentials Odoo
4. Clic sur "Tester" -> appel API pour vérifier les credentials
5. Clic sur "Enregistrer" -> stockage dans `company_secrets`
6. Le bouton devient "🔗 Odoo" + "↻ Sync"
7. Clic sur Sync -> appel edge function
8. Les factures apparaissent dans le tableau

---

## Etape 5 : Sécurité des credentials

### Stockage

Les credentials sont stockés dans `company_secrets` avec chiffrement :
- Chaque secret est une ligne séparée
- Le type identifie le secret (odoo_url, odoo_api_key, etc.)

### Accès

Seuls les utilisateurs avec accès à la société peuvent :
- Voir que le connecteur est configuré (pas les credentials)
- Déclencher une synchronisation

---

## Récapitulatif des fichiers

### À créer

| Fichier | Description |
|---------|-------------|
| `src/components/invoices/ConnectorDialog.tsx` | Dialog de configuration |
| `src/components/invoices/OdooConfigForm.tsx` | Formulaire Odoo |
| `src/components/invoices/PennylaneConfigForm.tsx` | Formulaire Pennylane (refactor) |
| `src/components/invoices/ConnectorStatus.tsx` | Badge statut |
| `src/hooks/useAccountingConnector.ts` | Hook gestion connecteurs |
| `supabase/functions/accounting-connector-sync/index.ts` | Edge function générique |

### À modifier

| Fichier | Description |
|---------|-------------|
| `src/pages/Invoices.tsx` | Remplacer bouton Pennylane par ConnectorStatus |
| `supabase/config.toml` | Ajouter accounting-connector-sync |

### À supprimer (optionnel)

| Fichier | Description |
|---------|-------------|
| `supabase/functions/pennylane-invoices-sync/` | Fusionné dans accounting-connector-sync |

---

## Providers supportés

| Provider | Statut | API |
|----------|--------|-----|
| **Odoo 17** | Prioritaire | JSON-RPC |
| Pennylane | Existant | REST API |
| QuickBooks | Futur | OAuth2 |
| Sage | Futur | REST API |

---

## Points techniques Odoo 17

### Authentification JSON-RPC

Odoo 17 supporte deux méthodes :
1. **Mot de passe** : login/password classique
2. **Clé API** : générée dans Préférences Utilisateur > Sécurité

La clé API est préférable car :
- Plus sécurisée (ne donne pas accès au mot de passe)
- Peut être révoquée sans changer le mot de passe

### Champs account.move (Odoo 17)

| Champ | Type | Description |
|-------|------|-------------|
| `move_type` | Selection | 'out_invoice', 'in_invoice', 'out_refund', 'in_refund' |
| `state` | Selection | 'draft', 'posted', 'cancel' |
| `payment_state` | Selection | 'not_paid', 'partial', 'paid', 'reversed' |
| `invoice_date` | Date | Date de facturation |
| `invoice_date_due` | Date | Date d'échéance |
| `amount_untaxed` | Monetary | Total HT |
| `amount_tax` | Monetary | Total TVA |
| `amount_total` | Monetary | Total TTC |
| `partner_id` | Many2one | [id, name] du partenaire |

### Endpoint JSON-RPC

```
POST {odoo_url}/jsonrpc
Content-Type: application/json
```

---

## Planning

| Phase | Contenu |
|-------|---------|
| **Phase 1** | Hook + Dialog + OdooConfigForm + stockage credentials |
| **Phase 2** | Edge function Odoo sync + ConnectorStatus |
| **Phase 3** | Refactor Pennylane dans le même système |
| **Phase 4** | Ajout futurs providers (QuickBooks, Sage) |
