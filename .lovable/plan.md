

# Plan: Brancher le CTA "Obtenir ma licence à vie" sur Stripe Checkout

## Contexte
- Produit Stripe créé : `price_1T9RL4Itjz0ztyfF4Ho7cX0d` (497 € one-time)
- Edge function `create-checkout` existante — utilise un ancien price ID et redirige vers `/parametres`
- La page `/flow` a `CHECKOUT_URL = '#'` et ouvre dans un nouvel onglet

## Ce qui va être fait

### 1. Créer une edge function `create-flow-checkout`
- Dédiée à l'offre Flow (ne touche pas à l'existant `create-checkout`)
- Ne nécessite **pas** d'authentification (les visiteurs Flow ne sont pas forcément connectés)
- Si l'utilisateur est authentifié (header Authorization présent), on récupère son email pour pré-remplir Stripe
- Sinon, Stripe Checkout demandera l'email
- Price ID : `price_1T9RL4Itjz0ztyfF4Ho7cX0d`
- `success_url` → `/onboarding?source=flow` (redirige vers l'inscription/onboarding après paiement)
- `cancel_url` → `/flow`

### 2. Mettre à jour `src/pages/Flow.tsx`
- Remplacer le `ctaClick` pour appeler `supabase.functions.invoke('create-flow-checkout')` au lieu d'ouvrir un lien statique
- Ajouter un état loading sur les boutons CTA pendant l'appel
- En cas de succès, rediriger vers l'URL Stripe Checkout
- En cas d'erreur, afficher un toast

### 3. Configurer `supabase/config.toml`
- Ajouter `verify_jwt = false` pour `create-flow-checkout` (accès sans auth obligatoire)

## Détails techniques

```text
Visiteur clique CTA
       │
       ▼
invoke('create-flow-checkout')
       │
       ▼
Edge Function → Stripe Checkout Session (payment)
       │
       ▼
Stripe hébergé (paiement 497€)
       │
       ▼
success_url → /onboarding?source=flow
```

- L'edge function tente de lire le token auth si présent, sinon laisse Stripe collecter l'email
- Pas de webhook nécessaire pour l'instant

