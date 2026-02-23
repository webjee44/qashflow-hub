

# Plan d'optimisation SEO du site vitrine Qashflow

## Problemes identifies

1. **Toutes les URLs SEO pointent vers `pennylane-cash-flow-buddy.lovable.app`** au lieu de `qashflow.io` -- dans `SEOHead.tsx`, `index.html`, `robots.txt`, `sitemap.xml`
2. **La Landing page n'utilise pas le composant `SEOHead`** -- pas de meta dynamique, pas de JSON-LD
3. **Le JSON-LD dans `index.html` est obsolete** -- prix "highPrice: 79", "offerCount: 3" alors que c'est une licence a vie a 828 EUR
4. **Le JSON-LD dans `SEOHead.tsx` (generateOrganizationSchema)** a aussi un prix incorrect (29 EUR)
5. **Pas de schema FAQPage** sur la page Tarifs malgre la presence d'une FAQ
6. **Pas de balise hreflang** (pas bloquant si pas d'internationalisation prevue)

---

## Modifications prevues

### 1. `src/components/seo/SEOHead.tsx`

- Remplacer `BASE_URL` par `https://qashflow.io`
- Mettre a jour `generateOrganizationSchema` : prix 828 EUR, paiement unique, offerCount 1
- Verifier que les schemas JSON-LD exportes sont corrects

### 2. `index.html`

- Remplacer toutes les occurrences de `pennylane-cash-flow-buddy.lovable.app` par `qashflow.io`
- Mettre a jour le JSON-LD `SoftwareApplication` : `highPrice: 828`, `lowPrice: 0` (essai gratuit), `offerCount: 2`, `priceCurrency: EUR`
- Mettre a jour le JSON-LD `Organization` : URL vers `qashflow.io`

### 3. `public/robots.txt`

- Remplacer l'URL lovable.app par `https://qashflow.io`
- Mettre a jour le chemin du Sitemap vers `https://qashflow.io/sitemap.xml`

### 4. `public/sitemap.xml`

- Remplacer toutes les `<loc>` avec le domaine `https://qashflow.io`
- Mettre a jour les dates `<lastmod>` a `2026-02-23`

### 5. `src/pages/Landing.tsx`

- Ajouter le composant `<SEOHead>` avec title, description et keywords optimises
- Injecter le schema JSON-LD `SoftwareApplication` et `BreadcrumbList` via `<script type="application/ld+json">`

### 6. `src/pages/Tarifs.tsx`

- Le schema FAQ est deja injecte (OK) -- verifier que `breadcrumbSchema` et `faqSchema` utilisent le bon BASE_URL (corrige automatiquement via etape 1)

---

## Section technique

Fichiers modifies :
- `src/components/seo/SEOHead.tsx` -- BASE_URL + schema corrige
- `index.html` -- URLs + JSON-LD
- `public/robots.txt` -- domaine
- `public/sitemap.xml` -- domaine + dates
- `src/pages/Landing.tsx` -- ajout SEOHead + JSON-LD

Aucune nouvelle dependance requise. Aucun changement backend.

