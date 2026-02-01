

# Plan : Gestion des Créances Clients & Dettes Fournisseurs

## Vision

Ajouter une nouvelle page `/creances` pour suivre les factures non payées (créances clients + dettes fournisseurs) avec :
- Saisie manuelle pour commencer
- Connecteur Pennylane en parallèle
- Intégration dans les prévisions de trésorerie à la date exacte d'échéance

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                            DASHBOARD                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Solde banque    │  │ Créances clients │  │ Dettes fourniss.│          │
│  │ 50 000 €        │  │ +45 000 €        │  │ -23 000 €       │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                          │
│  💡 Solde projeté = Banque + Créances à échéance - Dettes à échéance     │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                     NOUVELLE PAGE /creances                              │
│                                                                          │
│  Tabs: [Créances clients] [Dettes fournisseurs]                          │
│                                                                          │
│  ┌────────────────┬─────────┬────────────┬───────────┬─────────┐        │
│  │ Partenaire     │ N° Fact.│ Montant TTC│ Échéance  │ Statut  │        │
│  ├────────────────┼─────────┼────────────┼───────────┼─────────┤        │
│  │ Client A       │ FAC-001 │ 12 000 €   │ 15 fév.   │ ⏳ À venir│        │
│  │ Client B       │ FAC-002 │ 8 000 €    │ 3 fév.    │ 🔴 Échue │        │
│  │ Fournisseur X  │ F-456   │ 5 000 €    │ 20 fév.   │ ⏳ À venir│        │
│  └────────────────┴─────────┴────────────┴───────────┴─────────┘        │
│                                                                          │
│  [+ Ajouter facture]   [🔄 Sync Pennylane]                               │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                     PAGE /previsions enrichie                            │
│                                                                          │
│  Nouvelle section "Échéances factures" :                                 │
│  - Affiche les montants à encaisser/décaisser par date exacte            │
│  - S'ajoute aux prévisions existantes par catégorie                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Étape 1 : Base de données

### Nouvelle table `invoices`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Identifiant unique |
| `user_id` | uuid | Propriétaire |
| `company_id` | uuid | Société |
| `type` | text | 'receivable' (créance client) / 'payable' (dette fournisseur) |
| `partner_name` | text | Nom du client ou fournisseur |
| `invoice_number` | text | Numéro de facture |
| `invoice_date` | date | Date d'émission |
| `due_date` | date | Date d'échéance (pour le calcul de trésorerie) |
| `amount_ht` | numeric | Montant HT |
| `amount_ttc` | numeric | Montant TTC (ce qui impacte la trésorerie) |
| `vat_amount` | numeric | Montant TVA |
| `status` | text | 'pending' / 'paid' / 'overdue' |
| `paid_at` | date | Date de paiement effectif |
| `transaction_id` | uuid | Lien vers transaction de rapprochement |
| `category_id` | uuid | Catégorie associée |
| `source` | text | 'manual' / 'pennylane' / 'odoo' |
| `external_id` | text | ID dans le système source |
| `notes` | text | Notes libres |
| `created_at` | timestamptz | Date création |
| `updated_at` | timestamptz | Date modification |

### Politiques RLS

- `SELECT` : user_id = auth.uid() OU has_company_access()
- `INSERT` : user_id = auth.uid()
- `UPDATE` : user_id = auth.uid()
- `DELETE` : user_id = auth.uid()

---

## Étape 2 : Interface - Page /creances

### 2.1 Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `src/pages/Invoices.tsx` | Page principale des créances |
| `src/components/invoices/InvoiceTable.tsx` | Tableau des factures |
| `src/components/invoices/InvoiceDialog.tsx` | Formulaire ajout/édition |
| `src/components/invoices/InvoiceStats.tsx` | KPIs en haut de page |
| `src/hooks/useInvoices.ts` | Hook CRUD + calculs |

### 2.2 Formulaire de saisie

Champs :
- Type : Créance client / Dette fournisseur (toggle)
- Partenaire : texte libre (autocomplete des existants)
- N° Facture : texte
- Date d'émission : date picker
- Date d'échéance : date picker
- Montant HT / TVA / TTC : avec calcul automatique
- Catégorie : select parmi les catégories existantes
- Notes : textarea optionnel

### 2.3 Tableau des factures

Colonnes :
- Partenaire
- N° Facture
- Montant TTC
- Échéance (avec badge couleur : vert si > 7j, orange si < 7j, rouge si échue)
- Statut (En attente / Échue / Payée)
- Actions (Éditer / Marquer payée / Supprimer)

Filtres :
- Tabs : Créances clients / Dettes fournisseurs / Toutes
- Statut : En attente / Échue / Payée
- Période

---

## Étape 3 : Connecteur Pennylane

### 3.1 Edge Function `pennylane-invoices-sync`

Endpoints Pennylane à appeler :
- `GET /api/external/v2/customer_invoices` → créances clients
- `GET /api/external/v2/supplier_invoices` → dettes fournisseurs

Logique :
1. Récupérer les factures depuis Pennylane (status = pending ou open)
2. Pour chaque facture, vérifier si elle existe déjà (via `external_id`)
3. Si nouvelle → INSERT
4. Si existante → UPDATE (status, amount, etc.)
5. Marquer automatiquement "paid" si status = paid dans Pennylane

### 3.2 Secret Pennylane

Le secret `PENNYLANE_API_KEY` existe déjà dans le projet.

### 3.3 Bouton de synchronisation

Dans la page `/creances`, un bouton "🔄 Sync Pennylane" qui :
- Appelle l'edge function
- Affiche un toast avec le nombre de factures importées/mises à jour
- Raffraîchit le tableau

---

## Étape 4 : Intégration Dashboard

### Nouveaux KPIs

Ajouter 2 cartes dans le Dashboard :

1. **Créances clients** 
   - Total des invoices type='receivable' + status='pending'
   - Icône : FileText ou Receipt

2. **Dettes fournisseurs**
   - Total des invoices type='payable' + status='pending'
   - Icône : FileText ou Receipt

### Formule solde projeté

```
Solde projeté à J+30 = 
  Solde banque actuel
  + Créances clients (échéance dans les 30j)
  - Dettes fournisseurs (échéance dans les 30j)
  + Autres prévisions manuelles
```

---

## Étape 5 : Intégration Prévisions

### Enrichissement du ForecastTable

Ajouter une section "Échéances factures" qui affiche :
- Par mois (ou par semaine selon la période)
- Les encaissements attendus (créances à échéance)
- Les décaissements attendus (dettes à échéance)

Option : permettre de basculer entre vue "catégories" et vue "échéances factures"

---

## Étape 6 : Rapprochement automatique (optionnel, phase 2)

Quand une transaction arrive via Bridge :
1. Chercher une facture correspondante :
   - Montant à ±5% près
   - Date proche de l'échéance (±7 jours)
2. Si match unique → proposer le rapprochement
3. Si rapproché → marquer la facture comme "paid"

---

## Navigation

### Mise à jour de la Sidebar

Ajouter dans `treasuryNavItems` :
```typescript
{ icon: Receipt, label: 'Créances', href: '/creances', prefetchKeys: ['invoices'] },
```

### Mise à jour de App.tsx

Ajouter la route :
```tsx
<Route path="/creances" element={<Suspense fallback={<PageLoader />}><Invoices /></Suspense>} />
```

---

## Récapitulatif des fichiers

### À créer

| Fichier | Description |
|---------|-------------|
| `src/pages/Invoices.tsx` | Page principale |
| `src/components/invoices/InvoiceTable.tsx` | Tableau |
| `src/components/invoices/InvoiceDialog.tsx` | Formulaire |
| `src/components/invoices/InvoiceStats.tsx` | KPIs |
| `src/hooks/useInvoices.ts` | Hook CRUD |
| `supabase/functions/pennylane-invoices-sync/index.ts` | Sync Pennylane |

### À modifier

| Fichier | Description |
|---------|-------------|
| `src/App.tsx` | Ajouter route /creances |
| `src/components/layout/Sidebar.tsx` | Ajouter lien navigation |
| `src/pages/Dashboard.tsx` | Ajouter 2 cartes KPI |
| `src/hooks/useDashboardStats.ts` | Calculer totaux créances |
| `supabase/config.toml` | Ajouter fonction pennylane-invoices-sync |

### Migration SQL

Création de la table `invoices` avec RLS.

---

## Planning

| Phase | Contenu | Priorité |
|-------|---------|----------|
| **Phase 1** | Table SQL + hook + page /creances + saisie manuelle | Maintenant |
| **Phase 2** | Connecteur Pennylane (sync factures) | Maintenant |
| **Phase 3** | KPIs Dashboard + solde projeté enrichi | Ensuite |
| **Phase 4** | Intégration dans ForecastTable | Ensuite |
| **Phase 5** | Rapprochement auto transactions/factures | Plus tard |

---

## Points clés anti-usine à gaz

1. **Pas de workflow complexe** : juste 3 statuts (pending → overdue auto → paid)
2. **Pas de relances** : ce n'est pas un CRM
3. **Focus cash** : l'objectif est le solde projeté, pas la comptabilité
4. **UI minimaliste** : un tableau simple avec filtres, comme le reste de l'app
5. **Date exacte** : les échéances impactent les prévisions au jour près

