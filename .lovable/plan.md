

# Facturation isolee par organisation

## Concept

Aujourd'hui, tu as une seule organisation "GROUPE TRADEFLIX" avec toutes tes societes dedans. L'abonnement est lie a ton compte utilisateur, pas a l'organisation.

Pour isoler Vapeclub sur la facturation, la solution la plus simple est de **creer une seconde organisation dediee a Vapeclub**, avec son propre abonnement Stripe et ses propres coordonnees de facturation.

```text
Avant :
  GROUPE TRADEFLIX (1 abonnement sur ton email)
    ├── Holding
    ├── Vapeclub
    └── Autre societe

Apres :
  GROUPE TRADEFLIX (abonnement A)         VAPECLUB (abonnement B)
    ├── Holding                              └── Vapeclub SAS
    └── Autre societe
```

Tu restes proprietaire des deux organisations. Tu bascules de l'une a l'autre via un selecteur dans l'interface. Chaque organisation a :
- Son propre abonnement Stripe (factures separees)
- Son adresse de facturation propre
- Ses propres societes, comptes bancaires, transactions, etc.

## Ce qui change pour toi au quotidien

- Un **selecteur d'organisation** apparait dans la barre laterale (en plus du selecteur de societe existant)
- Quand tu es sur "GROUPE TRADEFLIX", tu vois tes societes du groupe
- Quand tu bascules sur "VAPECLUB", tu vois uniquement cette entite
- Les factures Stripe de chaque organisation sont completement independantes

## Plan technique

### 1. Ajouter les infos de facturation sur l'organisation

Ajouter des colonnes a la table `organizations` :
- `billing_name` : raison sociale pour la facturation
- `billing_email` : email de facturation
- `billing_address_line1`, `billing_address_line2`, `billing_city`, `billing_postal_code`, `billing_country` : adresse de facturation

### 2. Migrer l'abonnement de "par utilisateur" a "par organisation"

Modifier les edge functions Stripe pour utiliser l'organisation comme unite de facturation :
- **create-checkout** : recevoir un `organization_id`, creer le customer Stripe avec les infos de facturation de l'organisation, stocker le `stripe_customer_id` sur l'organisation
- **check-subscription** : recevoir un `organization_id`, verifier l'abonnement de cette organisation (pas de l'email utilisateur)
- **customer-portal** : recevoir un `organization_id`, ouvrir le portail Stripe du customer de cette organisation

### 3. Ajouter un selecteur d'organisation dans l'interface

- Modifier la sidebar pour afficher un selecteur d'organisation quand l'utilisateur est membre de plusieurs organisations
- Au changement d'organisation, mettre a jour le contexte et recharger les societes correspondantes
- Le selecteur de societe existant se filtre automatiquement sur l'organisation selectionnee

### 4. Formulaire de facturation dans les parametres

- Ajouter un onglet ou une section "Facturation" dans les parametres
- Formulaire pour renseigner la raison sociale, l'email de facturation et l'adresse
- Bouton pour acceder au portail Stripe de l'organisation courante
- Bouton pour s'abonner si l'organisation n'a pas encore d'abonnement

### 5. Permettre la creation d'une nouvelle organisation

- Ajouter un bouton "Creer une organisation" dans le selecteur d'organisation
- Dialogue simple : nom de l'organisation + infos de facturation
- L'utilisateur est automatiquement proprietaire de la nouvelle organisation
- Les societes peuvent etre deplacees d'une organisation a l'autre (optionnel, phase 2)

## Fichiers concernes

- Migration SQL : ajout colonnes facturation sur `organizations`
- `supabase/functions/create-checkout/index.ts` : passer a la facturation par organisation
- `supabase/functions/check-subscription/index.ts` : verifier par organisation
- `supabase/functions/customer-portal/index.ts` : portail par organisation
- `src/hooks/useSubscription.ts` : passer l'organisation courante
- `src/hooks/useOrganization.tsx` : selecteur multi-organisation
- `src/hooks/useCompany.tsx` : filtrer les societes par organisation
- `src/components/layout/Sidebar.tsx` : selecteur d'organisation
- `src/pages/Settings.tsx` : section facturation

## Ce qui ne change PAS

- L'isolation des donnees par societe reste identique
- Le selecteur de societe existant fonctionne comme avant (filtre par l'organisation selectionnee)
- Les fonctionnalites treasury et business plan ne sont pas impactees
- Les membres invites peuvent etre dans une seule ou plusieurs organisations selon les invitations

