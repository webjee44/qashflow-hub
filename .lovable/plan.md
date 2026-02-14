

## Refonte Landing Page Qashflow - "Direction Financiere Augmentee"

Rewrite complet de `src/pages/Landing.tsx` suivant le brief "One-Page" fourni, en conservant le `PublicNavbar`, le footer, et la logique existante (email capture, navigation).

---

### Nouvelle structure de la page (7 sections)

#### Section 1 - Hero
- **H1** : "Pilotez votre rentabilite en temps reel, pas votre comptabilite."
- **Sous-titre** : "L'IA qui centralise vos banques, anticipe votre cash-flow et decomplexifie la finance. Pour une vision claire de toutes vos societes, sans ouvrir un seul Excel."
- **CTA** : Input email + bouton "Demarrer mon essai gratuit (30j)"
- **Reassurance** : Gratuit 30 jours / Sans carte bancaire / Annulation facile
- **Visuel** : Screenshot du dashboard (`screenshot-dashboard.png`) dans un cadre navigateur avec effet glassmorphism
- **Style** : Fond avec radial gradient subtil bleu-violet, badge "Direction Financiere augmentee par l'IA"

#### Section 2 - Pain Points
- Titre : "Vous reconnaissez-vous ?"
- 3 cartes avec effet glassmorphism (`bg-card/60 backdrop-blur-xl border border-white/10`) :
  - Le Brouillard (icone `Eye`) : "Je ne sais jamais combien il me reste vraiment a la fin du mois."
  - La Corvee (icone `Clock`) : "Je perds des heures a consolider les donnees de mes 3 societes."
  - Le Stress (icone `AlertTriangle`) : "Mon bilan arrive 6 mois trop tard pour prendre des decisions."

#### Section 3 - Les 3 Piliers (Proposition de valeur)
- Titre : "La visibilite financiere absolue"
- 3 cartes glassmorphism avec icones aerees :
  - **Visibilite Multi-Entites** (icone `Building2`) : "Consolidation instantanee de toutes vos structures. Un seul ecran pour votre groupe."
  - **Intelligence de Categorisation** (icone `Bot`) : "L'IA apprend de vos flux pour classer vos depenses. Zero erreur, zero oubli." + Barre de progression animee "98% des flux automatises"
  - **Predictif & Scenarios** (icone `TrendingUp`) : "Projetez votre tresorerie a 6 ou 12 mois pour valider vos investissements ou vos recrutements."

#### Section 4 - Humain + IA
- Titre : "L'outil qui libere votre equipe des taches ingrates"
- Layout 2 colonnes (texte + visuel illustratif) :
  - Texte : "Qashflow ne remplace pas votre expertise, il automatise la saisie manuelle. Redonnez a votre gestionnaire le temps d'analyser plutot que de copier-coller."
  - Benefice mis en avant : "Moins de stress administratif, plus de conseil strategique."
  - Visuel : Screenshot P&L (`screenshot-pnl.png`) dans un cadre avec glassmorphism

#### Section 5 - Reassurance & Securite
- Titre : "Vos donnees en securite absolue"
- 3 elements horizontaux avec icones :
  - DSP2 : "Synchronisation bancaire securisee (DSP2)"
  - Chiffrement : "Donnees cryptees AES-256"
  - UE : "Serveurs heberges en Union Europeenne"
- Badge : "Compatible avec toutes les banques francaises"

#### Section 6 - Pricing (conserve tel quel)
- Meme structure 2 colonnes Essai gratuit / Licence Lifetime 499 EUR
- Glassmorphism sur la carte populaire

#### Section 7 - CTA final + Footer (conserves)
- CTA gradient existant, texte adapte au nouveau positionnement
- Footer identique

---

### Style et design tokens

- **Glassmorphism** : nouvelle classe utilitaire CSS `.glass-card` dans `index.css` :
  ```css
  .glass-card {
    @apply bg-card/60 backdrop-blur-xl border border-white/10 shadow-lg;
  }
  ```
- **Gradient Hero** : fond radial bleu profond vers violet subtil via classes Tailwind inline
- **Barre de progression IA** : composant inline avec animation `shimmer` (deja definie dans tailwind config)
- **Animations** : framer-motion `whileInView` conservees pour les scroll reveals

### Fichiers modifies

| Fichier | Action |
|---------|--------|
| `src/pages/Landing.tsx` | Rewrite complet du contenu (sections, textes, layout) |
| `src/index.css` | Ajout de la classe `.glass-card` |

### Ce qui ne change PAS
- `PublicNavbar` : inchange
- Footer : structure conservee, texte legerement adapte
- Logique email/navigation : conservee
- Screenshots existants : reutilises (`screenshot-dashboard.png`, `screenshot-pnl.png`)
- Palette de couleurs CSS variables : inchangee (le bleu-violet est deja en place via `--primary: 241 86% 58%`)

