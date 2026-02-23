

## Rendre le WelcomeGuide plus synthetique

### Fichier : `src/components/onboarding/WelcomeGuide.tsx`

Simplifier le contenu pour reduire le texte :

- Retirer les descriptions longues de chaque section
- Garder uniquement le titre + une phrase tres courte (max 5-6 mots)
- Reduire le titre principal et le sous-titre
- Passer les cartes en layout horizontal compact avec icone + titre + micro-description sur une seule ligne

Exemple de rendu vise :

| Icone | Titre | Micro-description |
|-------|-------|-------------------|
| Dashboard | Tableau de bord | Solde et flux en un coup d'oeil |
| Arrows | Transactions | Vos operations bancaires |
| Trend | Previsions | Anticipez votre tresorerie |
| Tags | Categories | Classez vos depenses |
| Sparkles | IA | Categorisation automatique |

Le tout dans une card compacte avec le bouton "J'ai compris" en bas a droite, et le X pour fermer.

