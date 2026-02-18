

# Optimisations 95/100 : Validation Zod + Factory Backend

## Contexte

Le CTO a identifie 2 axes d'amelioration restants. Le point ErrorBoundary est deja en place (`App.tsx` ligne 96). Le `.gitignore` n'est pas pertinent car le `.env` est gere automatiquement par la plateforme.

---

## 1. Validation Zod sur les reponses API (Front-end)

Ajouter des schemas Zod pour valider les donnees retournees par la base de donnees avant qu'elles n'entrent dans l'application. Cela protege contre les changements de schema non synchronises.

### Fichier a creer : `src/lib/schemas.ts`

Schemas Zod pour les 3 entites principales :
- `transactionSchema` : id, date, amount, type, description, category_id, company_id, deleted_at...
- `invoiceSchema` : id, type, partner_name, amount_ht, amount_ttc, due_date, status...
- `categorySchema` : id, name, color, icon, type, company_id, parent_id...

Chaque schema utilise `.passthrough()` pour tolerer les champs supplementaires sans casser.

### Fichiers a modifier

| Fichier | Changement |
|---|---|
| `src/features/transactions/api/transactionApi.ts` | Wrapper `z.array(transactionSchema).parse(data)` sur les retours de `getByCompany` et `getRecentByCompany` |
| `src/features/invoices/api/invoiceApi.ts` | Wrapper `z.array(invoiceSchema).parse(data)` sur `getByCompany` |
| `src/features/categories/api/categoryApi.ts` | Wrapper `z.array(categorySchema).parse(data)` sur `getByCompany` |

La validation est appliquee uniquement sur les fonctions de **lecture** (SELECT) qui alimentent l'UI, pas sur les mutations (INSERT/UPDATE/DELETE) qui ne retournent pas de listes.

---

## 2. Factory de services backend (Edge Functions)

Creer une factory qui centralise l'instanciation du client Supabase admin + tous les repositories en un seul appel.

### Fichier a creer : `supabase/functions/_shared/serviceFactory.ts`

```text
createSupabaseServices()
  --> supabaseAdmin (SupabaseClient)
  --> transactionRepo (TransactionRepository)
  --> invoiceRepo (InvoiceRepository)
  --> automationRepo (AutomationRepository)
```

La factory lit `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` depuis l'environnement et retourne un objet avec le client + les 3 repositories pre-instancies.

### Fichiers a modifier (4 Edge Functions)

| Fichier | Avant | Apres |
|---|---|---|
| `categorize-transaction/index.ts` | `createClient(...)` + `new TransactionRepository(...)` | `const { transactionRepo } = createSupabaseServices()` |
| `apply-automation-rule/index.ts` | `createClient(...)` + `new AutomationRepository(...)` + `new TransactionRepository(...)` | `const { automationRepo, transactionRepo } = createSupabaseServices()` |
| `apply-all-automation-rules/index.ts` | idem | idem |
| `pennylane-invoices-sync/index.ts` | `createClient(...)` + `new InvoiceRepository(...)` | `const { invoiceRepo } = createSupabaseServices()` |

Chaque fonction passe de ~5 lignes de setup a 1 ligne. Le client `createClient` n'est plus repete.

---

## Resume des livrables

| Livrable | Fichiers | Type |
|---|---|---|
| Schemas Zod | `src/lib/schemas.ts` (nouveau) | Creation |
| Validation front | 3 fichiers API (`transactionApi`, `invoiceApi`, `categoryApi`) | Modification |
| Factory backend | `supabase/functions/_shared/serviceFactory.ts` (nouveau) | Creation |
| Simplification Edge Functions | 4 fichiers Edge Functions | Modification |

**Impact** : Zero changement fonctionnel. Renforcement de la robustesse (runtime type-safety) et reduction du code duplique backend (DRY).

