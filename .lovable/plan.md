
# Rehausser le prix a 828EUR et retravailler le pitch

## Changement de prix

Le prix passe de **499EUR** a **828EUR** (equivalent a 69EUR/mois sur 12 mois, aligne sur Fygr). Le prix barre passe de 1 000EUR a **1 656EUR** (equivalent a 138EUR/mois, soit le double). La remise reste a -50%.

Le nouveau pitch : "Le meme prix qu'un an d'abonnement chez un concurrent, mais a vie."

## Fichiers a modifier

### 1. `src/hooks/useSubscription.ts`
- `lifetimePrice`: 499 -> **828**
- `originalPrice`: 1000 -> **1656**
- Note : le `priceId` Stripe devra etre mis a jour manuellement dans Stripe (ou un nouveau price cree). Pour l'instant on met a jour le montant affiche cote front.

### 2. `src/pages/Tarifs.tsx`
- Mettre a jour les FAQ :
  - "Un seul paiement de **828EUR**..."
  - "Pourquoi 828EUR au lieu de 1 656EUR ?" -> nouvelle reponse axee sur la comparaison concurrents : "828EUR c'est le prix d'un an chez Fygr ou Agicap. Sauf qu'ici, c'est a vie."
  - Fin d'essai : montants mis a jour
- SEO title/description : montants mis a jour
- Retravailler le hero :
  - Titre : "Le prix d'un an d'abonnement, **pour toujours**"
  - Sous-titre : "Vos concurrents facturent 69EUR/mois. Nous, c'est 828EUR une seule fois -- et c'est fini."
- Card pricing : description retravaillee "Le prix d'un an chez Fygr. Mais a vie."
- Ajouter une ligne de comparaison sous le prix : "= 69EUR/mois x 12 mois, puis plus rien a payer"
- Retirer le bandeau flash "OFFRE FLASH" un peu agressif, le remplacer par un bandeau plus sobre "Equivalent a 69EUR/mois -- mais a vie"
- CTA final : pitch retravaille avec la comparaison concurrents

### 3. `src/pages/Landing.tsx`
- Mettre a jour le plan local `plans[]` :
  - `price`: '499' -> '828'
  - `originalPrice`: '1 000' -> '1 656'

### 4. Comparatifs (3 fichiers)
- `src/pages/comparisons/QashflowVsZenfirst.tsx` : "Licence a vie -- 828EUR"
- `src/pages/comparisons/QashflowVsFygr.tsx` : "Licence a vie -- 828EUR"
- `src/pages/comparisons/QashflowVsAgicap.tsx` : "Licence a vie -- 828EUR"

### 5. `src/components/layout/TrialExpiredBlocker.tsx`
- Les montants sont deja dynamiques via `PLANS.pro.lifetimePrice` et `PLANS.pro.originalPrice`, donc la mise a jour dans `useSubscription.ts` suffit.

### 6. `src/components/settings/BillingCard.tsx`
- Dynamique via `PLANS.pro.lifetimePrice`, pas de changement necessaire.

## Section technique

- Le `priceId` Stripe (`price_1SzN92Itjz0ztyfFAwU5xdOD`) devra correspondre au nouveau montant de 828EUR. Si ce n'est pas encore fait dans Stripe, il faudra creer un nouveau Price a 828EUR et mettre a jour le `priceId` dans `useSubscription.ts`.
- Aucune modification de base de donnees requise.
- 6 fichiers a modifier au total.
