
## Passer de l'abonnement au Lifetime License 499€

### Contexte
Changement de modele commercial : au lieu d'un abonnement mensuel/annuel, on passe a une licence a vie (one-time payment) a **499€** au lieu de 1 000€ (soit -50%). L'essai gratuit de 30 jours est conserve.

### Produit Stripe cree
- **Product ID** : `prod_TxHiDrkeAaBxbk`
- **Price ID** : `price_1SzN92Itjz0ztyfFAwU5xdOD`
- **Montant** : 499€ (paiement unique)

---

### Modifications

#### 1. `src/hooks/useSubscription.ts` — Configuration du plan
- Remplacer les champs `price`, `annualPrice`, `annualMonthlyEquivalent`, `priceId`, `priceIdAnnual` par un seul `lifetimePrice: 499`, `originalPrice: 1000`, `priceId` lifetime
- Mettre a jour `productId` vers `prod_TxHiDrkeAaBxbk`
- Ajouter `discount: 50` (pourcentage de reduction)
- La logique `check-subscription` reste compatible (verifie aussi les paiements one-time)

#### 2. `supabase/functions/create-checkout/index.ts` — Mode payment
- Changer `mode: "subscription"` en `mode: "payment"`
- Retirer la logique `priceId` dynamique (un seul prix)
- Hardcoder le price ID `price_1SzN92Itjz0ztyfFAwU5xdOD`

#### 3. `supabase/functions/check-subscription/index.ts` — Verifier les paiements one-time
- En plus de chercher les subscriptions actives, chercher aussi les `checkout.sessions` completed avec `mode: "payment"` pour le client
- Ou chercher les `payment_intents` succeeded pour le customer
- Si un paiement lifetime est trouve, retourner `subscribed: true, plan: "lifetime"`

#### 4. `src/pages/Tarifs.tsx` — Refonte de la page pricing
- Supprimer le toggle mensuel/annuel
- Afficher le prix barre **1 000€** et le prix actuel **499€**
- Remplacer "/mois" par "paiement unique"
- Adapter le badge "OFFRE FLASH — Economisez 501€"
- Adapter la FAQ (supprimer les questions sur abonnement mensuel/annuel, ajouter questions sur licence a vie)
- Garder le CTA "Commencer l'essai gratuit" (30 jours) puis bouton "Acheter la licence"
- Adapter le texte CTA final en bas de page

#### 5. `src/components/layout/TrialExpiredBlocker.tsx` — Adapter le blocker
- Remplacer "99€/mois" par "499€ — Licence a vie"
- Adapter le bouton "Ajouter un moyen de paiement" vers "Acheter la licence"

#### 6. `src/components/settings/BillingCard.tsx` — Adapter la facturation
- Remplacer les boutons "S'abonner 99€/mois" et "Annuel" par un seul bouton "Acheter la licence — 499€"
- Adapter l'affichage du statut : "Licence Lifetime" au lieu de "Plan PRO"
- Supprimer "Prochain renouvellement" (pas de renouvellement en lifetime)

#### 7. `src/components/settings/OrganizationCard.tsx` — Adapter la carte org
- Supprimer le toggle billing period (mensuel/annuel)
- Afficher "499€ — Paiement unique" au lieu des prix mensuels/annuels
- Afficher le prix barre 1 000€
- Adapter le badge et le CTA

#### 8. `supabase/functions/customer-portal/index.ts` — Adapter le portail
- Le portail Stripe reste utile pour consulter les factures, meme sans abonnement recurrent

---

### Details techniques

**Verification du paiement lifetime (check-subscription)** : on cherchera les `checkout.sessions` en mode `payment` avec `payment_status: "paid"` pour le customer. Si trouve, on retourne `subscribed: true, plan: "lifetime"`. Cela evite d'avoir besoin de webhooks.

**Essai gratuit** : conserve tel quel via le champ `trial_ends_at` sur l'organisation. L'essai ne passe plus par Stripe (pas de trial sur un one-time payment), il reste gere en interne.

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useSubscription.ts` | Config plan lifetime, prix, IDs Stripe |
| `supabase/functions/create-checkout/index.ts` | mode: "payment", price ID unique |
| `supabase/functions/check-subscription/index.ts` | Verifier paiements one-time |
| `src/pages/Tarifs.tsx` | Refonte page tarifs lifetime |
| `src/components/layout/TrialExpiredBlocker.tsx` | Texte et prix lifetime |
| `src/components/settings/BillingCard.tsx` | Bouton et affichage lifetime |
| `src/components/settings/OrganizationCard.tsx` | Carte org sans toggle billing |
| `supabase/functions/customer-portal/index.ts` | Ajustements mineurs |
