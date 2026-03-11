

# Audit final démo CFO — Constats et corrections

## Ce qui fonctionne bien
- **Prévisions** : Tableau rempli, graphique lisible, soldes cohérents
- **Tableau de bord** : Solde total 47 000 € affiché, 2 comptes bancaires visibles (ChaussuresPro), graphique + transactions récentes OK
- **Transactions** : 47 opérations pour ChaussuresPro, libellés réalistes, banques affichées sur mars
- **Catégorisation** : 11 catégories bien structurées (revenus + dépenses)
- **Automatisations IA** : 5 règles en place
- **3 sociétés** accessibles via le sélecteur

---

## Problèmes identifiés (par criticité)

### 1. CRITIQUE — Engagements : filtre par défaut "En attente" = page vide
La page Engagements s'ouvre avec le filtre **"En attente"** (status = `pending`). Or toutes les factures en base ont soit le statut `pending` mais avec des `due_date` passées, donc l'UI les affiche comme **"Échue"** et non "En attente". Résultat : **tableau vide à l'ouverture**. Un CFO voit "Aucune facture" et passe son chemin.

**Fix** : Changer le filtre par défaut de la page Engagements pour afficher **"Tous statuts"** au lieu de "En attente". Modification dans `src/pages/Invoices.tsx` ou le composant `InvoiceTable`.

### 2. CRITIQUE — Factures sans catégorie assignée
Les 25 factures démo n'ont aucune `category_id`. Chaque ligne affiche "Sélect. catégorie" — c'est un manque de finition visible.

**Fix** : UPDATE SQL pour assigner les catégories pertinentes aux factures (Fournisseurs → catégorie "Fournisseurs chaussures", Loyer → "Loyer", etc.).

### 3. IMPORTANT — 21 transactions non catégorisées (badge "8" dans le menu)
Le badge rouge "8" sur "Transactions" (non catégorisées pour la société active) donne une impression de désordre. Sur les 3 sociétés, 21 transactions au total n'ont pas de catégorie.

**Fix** : UPDATE SQL pour assigner les catégories à ces 21 transactions.

### 4. IMPORTANT — Catégories "Virement intercompte" en doublon
ChaussuresPro et CloudSoft ont chacune **2 catégories "Virement intercompte"** identiques. Un CFO attentif le remarquera dans la page Catégorisation.

**Fix** : DELETE SQL du doublon (celui sans transactions rattachées) pour chaque société.

### 5. MINEUR — Factures "pending" mais échues → toutes en rouge
Les factures avec `status = 'pending'` et `due_date` passée s'affichent en rouge "Échue". C'est techniquement correct mais visuellement alarmant : **100% des créances sont en retard**. Pas crédible.

**Fix** : Mettre à jour les `due_date` de quelques factures pour les placer **dans le futur** (mars-avril 2026) avec status `pending`, et passer les plus anciennes en `paid`.

### 6. MINEUR — "Dernière synchro IA 14 févr., 04:00" sur les transactions
La date de dernière synchronisation affichée est figée au 14 février, ce qui semble périmé en mars.

**Fix** : Mettre à jour le champ `last_sync_at` des bridge_accounts au 10 mars 2026.

---

## Plan d'exécution

### Étape 1 — Corrections de données (SQL)
- Supprimer les doublons "Virement intercompte" (2 DELETE)
- Catégoriser les 21 transactions orphelines
- Assigner des catégories aux 25 factures
- Mettre à jour les `due_date` des factures pour un mix réaliste (quelques pending futures, quelques paid)
- Mettre à jour `last_sync_at` des bridge_accounts

### Étape 2 — Correction de code
- Changer le filtre par défaut de la page Engagements de "En attente" à "Tous statuts"

Aucune autre modification de code nécessaire.

