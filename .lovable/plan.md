
# Optimisation CRO de la section Pricing

## Objectif
Augmenter le taux de conversion sur la carte "Licence Lifetime" avec des techniques d'urgence et de copywriting plus engageant.

## Changements prevus

### 1. CTA plus engageant
Remplacer "Acheter la licence" par **"J'en profite maintenant"** -- plus emotionnel, moins transactionnel.

### 2. Compte a rebours de session
Ajouter un timer degressif (ex: 15 minutes) qui demarre a l'ouverture de la page et persiste en `sessionStorage`. Affiche sous le prix un texte du type : **"Offre valable encore 14:32"** avec un compte a rebours en temps reel.

- Le timer demarre a 15 minutes a la premiere visite de la session
- Se sauvegarde en `sessionStorage` pour persister entre navigations sur le site
- Se reinitialise a chaque nouvelle session navigateur
- Affiche en rouge/orange sous le prix avec une icone horloge

### 3. Texte d'urgence supplementaire
Ajouter sous le CTA une ligne du type : **"Offre de lancement -- prix amene a augmenter"** pour renforcer l'urgence.

## Details techniques

**Fichier modifie : `src/pages/Landing.tsx`**

- Ajout d'un hook `useState` + `useEffect` pour le countdown (sessionStorage key: `pricing-countdown-start`)
- Le CTA du plan populaire passe de "Acheter la licence" a "J'en profite maintenant"
- Ajout d'un bloc countdown anime entre le prix et les features (ou juste au-dessus du CTA)
- Ajout d'une ligne de micro-copy sous le bouton CTA

Aucun nouveau fichier necessaire, tout tient dans le composant Landing.
