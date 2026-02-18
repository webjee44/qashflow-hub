# Qashflow

**Gestion de trésorerie et business plan pour les TPE/PME françaises.**

Qashflow permet aux entrepreneurs de piloter leur trésorerie, construire un prévisionnel financier complet (compte de résultat, bilan, plan de financement) et suivre leurs factures — le tout depuis une interface moderne et intuitive.

## Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **State / Data** | TanStack React Query, React Hook Form, Zod |
| **Backend** | Lovable Cloud (Supabase) — Auth, Database, Edge Functions, Storage |
| **Charts** | Recharts |
| **PDF** | @react-pdf/renderer |
| **Tests** | Vitest, Testing Library, jsdom |
| **Animations** | Framer Motion |

## Fonctionnalités principales

- 📊 **Dashboard trésorerie** — solde bancaire, flux entrants/sortants, graphiques
- 🏦 **Synchronisation bancaire** — connexion automatique via Bridge API
- 📑 **Gestion des factures** — import Pennylane/Odoo, suivi créances/dettes
- 📈 **Prévisions de trésorerie** — par catégorie, comparaison réalisé vs prévu
- 📋 **Business Plan complet** — revenus, charges fixes/variables, personnel, investissements, financements, scénarios, bilan, P&L, cash-flow
- 🤖 **Automatisations** — catégorisation automatique des transactions par règles
- 👥 **Multi-organisation** — gestion d'équipe avec rôles (owner, admin, member, viewer)
- 🔒 **Sécurité** — RLS sur toutes les tables, logger centralisé, ErrorBoundary

## Installation locale

```bash
# Cloner le repo
git clone <YOUR_GIT_URL>
cd qashflow-hub

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

## Variables d'environnement

Créez un fichier `.env` à la racine avec :

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-id>
```

> Ces variables sont fournies automatiquement par Lovable Cloud.

## Scripts disponibles

| Script | Description |
|---|---|
| `npm run dev` | Serveur de développement (Vite) |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualisation du build |
| `npm run lint` | Vérification ESLint |

## Architecture

```
src/
├── components/          # Composants UI réutilisables
│   ├── ui/              # Primitives shadcn/ui
│   ├── layout/          # Header, Sidebar, Navbar
│   ├── dashboard/       # Widgets du tableau de bord
│   ├── transactions/    # Gestion des transactions
│   ├── invoices/        # Gestion des factures
│   ├── forecasts/       # Prévisions de trésorerie
│   ├── categories/      # Catégories de transactions
│   ├── automations/     # Règles d'automatisation
│   ├── settings/        # Paramètres utilisateur
│   └── superadmin/      # Administration système
├── features/
│   └── business-plan/   # Module Business Plan complet
│       ├── charts/      # Graphiques spécifiques BP
│       ├── components/  # Tables et cartes BP
│       ├── dialogs/     # Formulaires et wizards
│       ├── hooks/       # Logique métier BP
│       ├── pdf/         # Export PDF du BP
│       └── api/         # Couche d'accès données
├── hooks/               # Hooks applicatifs globaux
├── pages/               # Routes de l'application
├── lib/                 # Utilitaires (logger, parsers, mock data)
├── services/            # Services métier
└── integrations/        # Client Supabase (auto-généré)

supabase/
├── functions/           # Edge Functions (backend serverless)
└── migrations/          # Migrations SQL
```

## Conventions

- **Logger centralisé** : utiliser `logError`, `logInfo`, `logWarn`, `logDebug` depuis `@/lib/logger` — jamais `console.*` directement
- **Design tokens** : utiliser les tokens sémantiques Tailwind (`bg-primary`, `text-foreground`) — pas de couleurs hardcodées
- **Lazy loading** : toutes les pages protégées utilisent `React.lazy()` + `Suspense`
- **ErrorBoundary** : wraps l'application entière pour capturer les crashes React

## Déploiement

L'application est déployée automatiquement via Lovable. Pour publier :

1. Ouvrir le projet dans Lovable
2. Cliquer sur **Share → Publish**

Domaine personnalisé : **Settings → Domains → Connect Domain**

## Licence

Projet propriétaire — tous droits réservés.
