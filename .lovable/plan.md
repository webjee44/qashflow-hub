
# Refonte page Tarifs — 99€/mois + Offre Flash Annuelle -50% avec CRO

## Objectif
Passer le prix mensuel a 99€, ajouter une offre annuelle a -50% (soit ~594€/an au lieu de 1 188€), et optimiser la conversion avec des elements CRO (countdown, urgence, social proof, toggle mensuel/annuel).

## Etapes

### 1. Creer le prix annuel sur Stripe
- Creer un nouveau prix Stripe : **594€/an** (recurring yearly) sur le produit existant `prod_ToH9Su89hO20pL`
- Le prix mensuel existant (`price_1SqebAItjz0ztyfFUOsYxcW5`) sera mis a jour dans le code pour refleter 99€ (il faudra aussi creer un nouveau prix mensuel Stripe a 9900 centimes)

### 2. Mettre a jour `useSubscription.ts` (PLANS)
- Changer `price: 49` en `price: 99`
- Ajouter un `priceIdAnnual` et un `annualPrice` (594€ = 49.50€/mois equivalent)
- Mettre a jour les `priceId` avec les nouveaux IDs Stripe

### 3. Refondre `Tarifs.tsx` — Page complete CRO
- **Bandeau flash en haut** : "OFFRE FLASH — Economisez 50% sur l'annuel" avec fond degrade rouge/orange
- **Toggle Mensuel / Annuel** : switch avec badge "-50%" sur l'annuel
- **Countdown timer** : composant qui decompte en temps reel (jours, heures, minutes, secondes) avec une date de fin configurable (ex: fin du mois en cours)
- **Pricing card** :
  - Prix barre pour l'annuel (~~1 188€~~ → 594€/an soit 49,50€/mois)
  - Badge "OFFRE LIMITEE" ou "MEILLEURE OFFRE"
  - Nombre de places restantes simule ("Plus que 12 places a ce tarif")
- **Social proof** : "Rejoint par +150 entrepreneurs" ou logos/temoignages
- **CTA anime** : bouton pulse avec texte d'urgence
- **Garantie** : "Satisfait ou rembourse 30 jours" avec icone bouclier
- Mise a jour du FAQ (prix 99€, offre annuelle)
- Mise a jour SEO meta

### 4. Mettre a jour `Landing.tsx`
- Changer la reference "49€" en "99€" dans le texte

### 5. Mettre a jour `OrganizationCard.tsx` et `TrialExpiredBlocker.tsx`
- Ces composants utilisent `PLANS.pro.price` donc seront automatiquement mis a jour
- Verifier que le checkout passe le bon `priceId` (mensuel ou annuel selon le choix)

### 6. Mettre a jour `create-checkout` edge function
- Accepter un parametre `priceId` dynamique (deja le cas) pour supporter mensuel et annuel

---

## Details techniques

### Nouveau composant : Countdown Timer
- `useState` + `useEffect` avec `setInterval` toutes les secondes
- Calcule la difference entre `now()` et une date cible (fin du mois courant)
- Affiche JJ:HH:MM:SS dans des "cards" individuelles avec animation flip

### Structure de la page Tarifs refaite
```
- Flash Banner (urgence)
- Hero section (titre + sous-titre)
- Toggle Mensuel/Annuel
- Countdown timer
- 2 Pricing Cards cote a cote (Mensuel vs Annuel)
  - Annuel = mis en avant avec bordure, badge, prix barre
- Trust badges (securite, garantie, support)
- Social proof / chiffres
- FAQ mis a jour
- CTA final
```

### Fichiers modifies
| Fichier | Modification |
|---------|-------------|
| `src/hooks/useSubscription.ts` | Prix 99€, ajout priceId annuel |
| `src/pages/Tarifs.tsx` | Refonte complete CRO |
| `src/pages/Landing.tsx` | Texte 49€ → 99€ |

### Dependances Stripe
- Creer 2 nouveaux prix Stripe via l'outil : mensuel 99€ et annuel 594€
- L'edge function `create-checkout` fonctionne deja avec n'importe quel `priceId`
