

## Amelioration de l'experience post-connexion bancaire

### Objectif
Apres la connexion bancaire (ou le skip de cette etape), l'utilisateur arrive directement sur la page Transactions avec un module d'explication interactif des differentes sections de l'application, qu'il peut fermer definitivement.

### Changements prevus

#### 1. Redirection vers `/transactions` au lieu de `/dashboard`

**Fichier : `src/pages/Onboarding.tsx`**
- Modifier `handleComplete()` : remplacer `navigate('/dashboard')` par `navigate('/transactions')` 
- Meme chose pour le callback Bridge (`bridge_callback=success`)
- Ajouter un flag localStorage `show-welcome-guide` = `true` avant la redirection

#### 2. Nouveau composant `WelcomeGuide`

**Fichier : `src/components/onboarding/WelcomeGuide.tsx`** (nouveau)

Un bandeau/modal elegant en haut de la page Transactions qui presente les sections cles de l'application :

- **Tableau de bord** : Vue d'ensemble de votre tresorerie, solde, encaissements/decaissements
- **Transactions** : Toutes vos operations bancaires synchronisees automatiquement
- **Previsions** : Anticipez votre tresorerie future avec vos factures recurrentes
- **Categorisation** : Classez vos flux par categorie pour mieux comprendre vos depenses
- **Automatisations IA** : Laissez l'IA categoriser automatiquement vos transactions

Le composant :
- S'affiche uniquement si `localStorage.getItem('show-welcome-guide') === 'true'`
- Contient un bouton "J'ai compris" qui supprime la cle localStorage et ferme le guide definitivement
- Design : card avec fond gradient subtil, icones pour chaque section, animation d'entree Framer Motion

#### 3. Integration dans la page Transactions

**Fichier : `src/pages/Transactions.tsx`**
- Importer et afficher `<WelcomeGuide />` au-dessus du `<PageHeader>`

### Details techniques

- Le guide utilise les memes icones que la sidebar (`LayoutDashboard`, `ArrowLeftRight`, `TrendingUp`, etc.) pour la coherence visuelle
- Le state de fermeture est persiste dans `localStorage` (cle `welcome-guide-dismissed`) -- une fois ferme, il ne reapparait jamais
- Pas de modification de base de donnees necessaire : le flag `onboarding_completed` existant reste inchange
- Le composant `OnboardingTour` existant (spotlight guide) reste disponible separement et peut etre declenche depuis les parametres

