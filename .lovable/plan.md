

# Page comparative "Qashflow vs Zenfirst"

## Objectif

Creer une page "battle" SEO-friendly comparant Qashflow a Zenfirst, accessible depuis le footer de toutes les pages publiques. L'architecture sera pensee pour ajouter facilement d'autres comparatifs plus tard (vs Agicap, vs Fygr, etc.).

---

## Architecture

Un composant generique `ComparisonPage` recevra les donnees en props, ce qui permettra de creer de futures pages battle en quelques lignes.

```text
src/pages/comparisons/
  QashflowVsZenfirst.tsx    -- Page specifique avec les donnees
src/components/comparisons/
  ComparisonPage.tsx         -- Composant generique reutilisable
```

---

## Page "Qashflow vs Zenfirst"

### Structure de la page

1. **Hero** : Titre "Qashflow vs Zenfirst", sous-titre explicatif, badge "Comparatif 2026"
2. **Tableau comparatif** : Grille de fonctionnalites avec icones check/x pour chaque solution
3. **Section avantages cles** : 3-4 cartes mettant en avant les differenciateurs de Qashflow
4. **CTA final** : Bandeau d'appel a l'action vers l'essai gratuit

### Criteres de comparaison prevus

- Previsions de tresorerie
- Synchronisation bancaire automatique
- Categorisation IA
- Business Plan integre
- Scenarios de simulation
- Export PDF
- Multi-societes
- Tarification (licence lifetime vs abonnement)

---

## Modifications des footers

Ajout d'une section "Comparatifs" dans le footer de chaque page publique :

- `src/pages/Landing.tsx`
- `src/pages/APropos.tsx`
- `src/pages/Contact.tsx`
- `src/pages/Fonctionnalites.tsx`
- `src/pages/Tarifs.tsx`
- `src/pages/MentionsLegales.tsx`
- `src/pages/Confidentialite.tsx`

La nouvelle colonne contiendra le lien "Qashflow vs Zenfirst" (et les futurs comparatifs).

---

## Routing

Ajout dans `App.tsx` :

- `/comparatifs/qashflow-vs-zenfirst` -- route publique

---

## SEO

- Composant `SEOHead` avec title "Qashflow vs Zenfirst - Comparatif 2026" et meta description optimisee
- Ajout de l'URL dans `public/sitemap.xml`

---

## Details techniques

- La page utilise `PublicNavbar` comme les autres pages publiques
- Le composant `ComparisonPage` accepte un tableau de criteres `{ label, qashflow: boolean, competitor: boolean }` et le nom du concurrent
- Design coherent avec le reste du site (Tailwind, shadcn/ui Card, Badge, etc.)
- Responsive : le tableau se transforme en cartes empilees sur mobile
- Pour ajouter un futur comparatif (ex: vs Agicap), il suffira de creer un nouveau fichier avec les donnees et une route

