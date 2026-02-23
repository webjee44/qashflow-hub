

# Refonte du Hero et de l'USP de la Landing Page

Objectif : repositionner la page d'accueil pour mettre la **tresorerie** en avant comme feature principale, en s'inspirant de la structure de Fygr, puis positionner le Business Plan comme un avantage supplementaire.

---

## 1. Hero (Section 1) -- Recentrer sur la tresorerie

**Avant** : "Pilotez votre rentabilite en temps reel, pas votre comptabilite." (trop generique)

**Apres** :
- **Badge** : "Logiciel de gestion de tresorerie pour PME" (au lieu de "Direction Financiere augmentee par l'IA")
- **Titre H2** : "Suivez et anticipez votre tresorerie en toute simplicite" (inspire de Fygr : "Tracking and forecasting your cash flow has never been easier")
- **Sous-titre** : "Automatisez le suivi de votre tresorerie, synchronisez vos banques et anticipez votre cash-flow a 12 mois. L'outil de pilotage financier concu pour les PME."
- **CTA** : Conserver "Demarrer mon essai gratuit (7j)" + ajouter un 2e bouton "Demander une demo" (comme Fygr)
- **Reassurance** : Conserver les 3 puces existantes

## 2. Section Pain Points (Section 2) -- Adapter au vocabulaire tresorerie

Reformuler les 3 pain points pour etre plus concrets sur la tresorerie :
- **"Le Brouillard"** -> "Pas de visibilite" : "Ou en est ma tresorerie aujourd'hui ? Impossible de repondre sans jongler entre 3 banques."
- **"La Corvee"** -> "Les exports Excel" : "Je passe des heures chaque semaine a consolider mes releves bancaires dans un tableur."
- **"Le Stress"** -> "Les mauvaises surprises" : "Je decouvre mes decouvertes trop tard, sans marge de manoeuvre pour reagir."

## 3. Section 3 Piliers -- Restructurer autour de la tresorerie

Reorganiser les 3 piliers pour suivre le parcours utilisateur de Fygr :

1. **"Toutes vos banques en un seul ecran"** (icone Building2)
   - Centralisez tous vos comptes et devises
   - Consultez vos soldes en temps reel
   - Evitez les decouverts

2. **"Categorisation automatique par l'IA"** (icone Bot, garder la barre de progression 98%)
   - Definissez des categories metier
   - Catégorisation automatique des transactions
   - Vue claire de vos encaissements et decaissements

3. **"Previsions de tresorerie a 12 mois"** (icone TrendingUp)
   - Previsionnel automatique base sur votre historique
   - Scenarisation de vos hypotheses (embauche, investissement...)
   - Prise de decision en toute serenite

## 4. Section Humain + IA (Section 4) -- Ajouter le BP comme avantage bonus

Transformer cette section en "Et en plus..." qui presente le Business Plan :
- **Badge** : "Bonus"
- **Titre** : "Un Business Plan integre pour convaincre vos partenaires"
- **Texte** : "Au-dela du suivi quotidien, Qashflow genere automatiquement votre compte de resultat previsionnel, votre plan de financement et votre bilan. Tout est synchronise avec vos donnees reelles."
- Conserver le screenshot du PnL a droite

## 5. Sections Securite, CTA et Footer -- Inchanges

Ces sections restent en l'etat, elles fonctionnent bien.

---

## Details techniques

**Fichier modifie** : `src/pages/Landing.tsx`

Modifications :
- Mettre a jour les textes du Hero (badge, h2, paragraphe)
- Ajouter un bouton "Demander une demo" pointant vers `/contact`
- Reformuler les 3 pain points
- Restructurer les 3 piliers avec les nouveaux titres/descriptions orientes tresorerie
- Transformer la section 4 en mise en avant du Business Plan comme bonus
- Aucun changement de structure de composants, uniquement du contenu textuel

