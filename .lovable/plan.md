

# Landing Page "Offre Flow" — `/flow`

## Objectif
Créer une landing page dédiée à l'offre communauté Flow (497€ licence à vie, 30 places), accessible uniquement via `/flow`, non liée au menu de navigation. Design dark/premium avec accent vert électrique, ton direct (Félix parle en première personne).

## Structure de la page

### Fichier : `src/pages/Flow.tsx`
Page standalone avec ses propres styles inline/Tailwind (fond sombre `bg-gray-950`, texte blanc, accent `emerald-400`). Pas de `PublicNavbar` classique — juste le logo Qashflow en haut.

**Blocs dans l'ordre du brief :**

1. **Hero** — "Vous pilotez encore votre tréso sur Excel ?" + sous-titre personnel de Félix + Badge "Réservé abonnés Flow" + Compteur licences (27/30 en dur, modifiable) + CTA "Obtenir ma licence à vie — 497€" + mention deadline 31 mars
2. **Crédibilité** — "CEO de 7 sociétés" / "Top 1% mondial Lovable" / citation de Félix + initiales stylisées (pas de photo dispo)
3. **Le Problème** — Storytelling Félix (perte de CA fin 2024, 3h/semaine sur Excel) avec les 3 bullets (données pas à jour, fichiers qui cassent, décisions à l'aveugle)
4. **La Solution** — "Ce que Qashflow fait concrètement" : 4 features avec icônes + screenshots existants (`screenshot-dashboard`, `screenshot-previsions`, `screenshot-pnl`)
5. **L'Offre** — Bloc visuellement dominant : prix barré 1 068€/an → 497€ une fois, liste des inclus, badge Flow, compteur, deadline, gros CTA + texte réassurance (paiement sécurisé, remboursement 7j)
6. **FAQ** — 4 questions spécifiques du brief (disparition, taille entreprise, vs Agicap, comptable/DAF)
7. **Footer CTA** — Dernier rappel + CTA final

### Fichier : `src/App.tsx`
Ajouter une route publique `/flow` pointant vers le composant `Flow`.

## Détails techniques

- Le lien CTA pointe vers `#` (placeholder Stripe, commentaire pour remplacement)
- Compteur de licences : state local `useState(27)`, facilement remplaçable par une valeur dynamique plus tard
- Deadline : affichage "Jusqu'au 31 mars 2025" en dur
- Animations : `framer-motion` fadeUp comme sur la landing existante
- Responsive : mobile-first, mêmes breakpoints que le reste du site
- Dark theme forcé sur cette page uniquement (classes Tailwind directes, pas de modification du thème global)
- Réutilise les screenshots existants dans `src/assets/`

## Fichiers impactés
1. **`src/pages/Flow.tsx`** — Nouveau fichier (~350 lignes)
2. **`src/App.tsx`** — +1 route publique

