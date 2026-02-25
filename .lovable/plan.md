

## Analyse comparative Fygr vs Qashflow - Recommandations

### Ce que Fygr fait bien et que nous n'avons pas

Apres analyse du site fygr.io et de notre Landing page, voici les elements manquants classes par impact sur la conversion :

### 1. Social Proof avec logos clients (IMPACT FORT)
Fygr affiche une barre de logos de clients connus (Optical Center, Biocoop, Toulouse FC, Selency, Lifen, MWM...) avec le texte "Plus de 3 000 PME utilisent Fygr". Notre landing page n'a **aucun logo client** ni chiffre d'utilisateurs credible. La mention "+150 entrepreneurs ce mois-ci" sur la page Tarifs est insuffisante.

**Action** : Ajouter une section "logo bar" scrollante juste sous le hero avec des logos partenaires/clients. Meme sans vrais logos, afficher des badges de confiance (note Google, Capterra, etc.).

### 2. Notes et avis clients avec avatars (IMPACT FORT)
Fygr affiche des avis reels avec photo + nom + titre court ("Un vrai gain de temps", "Logiciel tres pratique et intuitif") dans un carrousel defilant. Egalement une note agrégée : "Google: 4,9 | Capterra: 4,8" directement dans le hero.

**Action** : Ajouter un carrousel de temoignages avec photo, nom, entreprise et citation courte. Ajouter une note agrégée pres du CTA hero.

### 3. Repetition du CTA a chaque section (IMPACT MOYEN)
Fygr place "Essai gratuit" + "Demander une demo" apres CHAQUE section de fonctionnalites (6 fois sur la page). Notre landing n'a qu'un CTA hero + un CTA final.

**Action** : Ajouter un bouton CTA secondaire apres chaque bloc de fonctionnalites (Pilier 1, 2, 3 et Business Plan).

### 4. Section app mobile (IMPACT MOYEN)
Fygr a une section dediee "Fygr dans votre poche" avec un mockup mobile montrant l'acces aux soldes, categorisation, et photo de justificatifs.

**Action** : Si l'app n'est pas responsive/mobile-first, au minimum montrer un screenshot mobile dans la landing.

### 5. Section securite plus detaillee (IMPACT MOYEN)
Fygr detaille ses partenaires bancaires (Bridge, Budget Insight, Fintecture) et son hebergement (AWS Francfort). Notre section securite est correcte mais moins specifique.

**Action** : Mentionner explicitement Bridge comme partenaire bancaire dans la section securite.

### 6. FAQ plus orientee objections (IMPACT FAIBLE-MOYEN)
Fygr a 8 FAQ directement sur la home, orientees objections metier ("J'ai deja un comptable", "J'ai deja un logiciel comptable"). Notre FAQ n'est que sur la page Tarifs.

**Action** : Ajouter une section FAQ directement sur la Landing page, avec des questions orientees objections business.

---

### Details techniques d'implementation

Les modifications porteraient sur un seul fichier principal :
- **`src/pages/Landing.tsx`** : Ajout de 4 nouvelles sections (logo bar, temoignages, FAQ, CTA repetes)

Composants potentiellement reutilisables :
- Un composant `TestimonialCarousel` avec animation framer-motion
- Un composant `LogoBar` avec scroll anime CSS

Aucune modification backend necessaire. Pas de nouvelles dependances.

### Priorites recommandees
1. Temoignages + notes (le plus impactant pour la conversion)
2. Logo bar clients
3. CTA repetes apres chaque section
4. FAQ sur la landing
5. Section mobile (optionnel)

