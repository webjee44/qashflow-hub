
# Refonte du funnel post-inscription (style Fygr)

## Objectif
Remplacer la page `/welcome` actuelle (confettis + un seul bouton "Commencer") par un funnel multi-etapes qui collecte les informations utilisateur et entreprise, puis propose la connexion bancaire. Les donnees sont sauvegardees progressivement (meme si l'utilisateur ne termine pas).

## Flux en 3 etapes

```text
/sign-up (existant)
    |
    v
/onboarding (nouvelle page, 3 etapes)
    |
    Etape 1 : Finaliser mon inscription
    |   - Prenom
    |   - Nom
    |   - Fonction principale (select)
    |   - Telephone (+33)
    |   -> Sauvegarde dans profiles a chaque "Valider"
    |
    Etape 2 : Informations sur mon entreprise
    |   - Nom de l'entreprise
    |   - Type d'activite (select)
    |   - Chiffre d'affaires (select, tranches)
    |   - Nombre d'entites (select)
    |   -> Sauvegarde dans profiles + update companies.name
    |
    Etape 3 : Connecter ma banque
    |   - Logo/badge securite
    |   - Texte explicatif
    |   - Bouton "+ Ajouter une banque" (lance Bridge)
    |   - Lien "Passer cette etape"
    |   - Badges : 100% conforme RGPD, Agregateurs certifies ACPR
    |   -> Redirect vers /dashboard
```

## Modifications de la base de donnees

Ajout de colonnes dans la table `profiles` :

| Colonne | Type | Default |
|---------|------|---------|
| first_name | text | null |
| last_name | text | null |
| job_title | text | null |
| company_activity_type | text | null |
| company_revenue_range | text | null |
| company_entity_count | text | null |

Ces colonnes permettent de capturer les donnees meme partiellement. Le champ `full_name` existant sera mis a jour automatiquement a partir de first_name + last_name.

## Valeurs des selects

**Fonction principale :**
- Dirigeant / CEO / Gerant
- DAF / RAF
- Finance / Comptabilite / Controle de Gestion
- Expert-Comptable
- Assistant / Office Manager / Secretaire
- Manager / Responsable (hors fonction finance)
- Freelance / Auto-Entrepreneur
- Autre

**Type d'activite :**
- Commercants
- Artisans
- Professions liberales
- Services / Conseil
- Industrie / Production
- Tech / Startup
- BTP / Construction
- Restauration / Hotellerie
- Autre

**Chiffre d'affaires :**
- Moins de 50 000 EUR
- De 50 000 a 250 000 EUR
- De 250 000 a 1 000 000 EUR
- De 1 000 000 a 5 000 000 EUR
- Plus de 5 000 000 EUR

**Nombre d'entites :**
- Une seule
- 2 a 3
- 4 a 10
- Plus de 10

## Fichiers a creer / modifier

### 1. Migration SQL
- Ajouter 6 colonnes a `profiles` (first_name, last_name, job_title, company_activity_type, company_revenue_range, company_entity_count)

### 2. Nouvelle page `src/pages/Onboarding.tsx`
- Composant multi-etapes avec un state `step` (1, 2, 3)
- Barre de progression en haut (3 points)
- Design clean sur fond blanc, centre, style Fygr (logo en haut, formulaire sobre)
- Sauvegarde progressive : a chaque "Valider", upsert dans `profiles` et passer a l'etape suivante. Si l'utilisateur quitte, les donnees deja soumises sont conservees.
- Etape 3 : reutilise la logique de `handleConnectBridge` de BankAccountsCard (bridge-auth + bridge-connect)
- Bouton "Passer" sur l'etape 3 pour aller directement au dashboard

### 3. `src/App.tsx`
- Ajouter la route `/onboarding` (protegee)
- Supprimer ou conserver `/welcome` en redirect vers `/onboarding`

### 4. `src/pages/SignUp.tsx`
- Changer `navigate('/welcome')` en `navigate('/onboarding')`

### 5. `src/hooks/useAuth.tsx`
- Passer `full_name` au signUp (actuellement supporte mais non utilise dans SignUp)

### 6. `src/components/layout/ProtectedRoute.tsx`
- Ajouter un check : si `profiles.onboarding_completed === false`, rediriger vers `/onboarding` (sauf si deja sur /onboarding)
- Cela garantit que les utilisateurs qui ont quitte en cours de route reprennent le funnel

### 7. Nettoyage
- La page `/welcome` existante redirigera vers `/onboarding`
- Les pages `/start`, `/start/verify`, `/start/welcome` (ancien flow OTP) restent en place mais ne sont plus utilisees dans le flux principal

## Capture des donnees partielles

Chaque etape sauvegarde independamment dans `profiles` via un `UPDATE` au clic sur "Valider". Meme si l'utilisateur quitte apres l'etape 1, on a deja son prenom, nom, fonction et telephone.

## Section technique

- Les 6 nouvelles colonnes sont toutes `text NULL` -- pas de contrainte, pas de migration destructive.
- La logique Bridge est extraite en fonctions reutilisables depuis `BankAccountsCard.tsx` (ou dupliquee proprement dans la page Onboarding pour eviter un refactor trop large).
- Le redirect URL pour Bridge sera `/onboarding?bridge_callback=success` pour revenir sur le funnel apres connexion.
- L'etape d'onboarding est trackee via `profiles.onboarding_step` (deja existant) : 0 = pas commence, 1 = etape 1 faite, 2 = etape 2 faite, 3 = complete.
- A la fin (etape 3 validee ou skipee), `profiles.onboarding_completed = true` et `profiles.onboarding_step = 3`, puis redirect vers `/dashboard`.
