

# Refactoring Clean Architecture : Pattern Repository

## Etat actuel

Le projet mélange actuellement 3 responsabilités dans les hooks React :
- Accès aux données (appels `supabase.from()`)
- Logique métier (transformations, calculs)
- Gestion UI (toasts, cache React Query)

**Inventaire :**
- **40+ hooks** dans `src/hooks/` avec des appels Supabase directs
- **20+ Edge Functions** avec logique inline
- **7 services** dans `src/services/` qui appliquent deja partiellement le pattern (BP uniquement)

## Progression

- [x] **Phase 1 : Transactions** — API layer + hook refactoré + backend Repository
- [x] **Phase 2 : Categories + Invoices** — API layers + hooks refactorés
- [x] **Phase 3 : Business Plan** — API layer créé, hooks refactorés, snapshots/notes extraits
- [ ] **Phase 4 : Edge Functions** — Refactorer pour utiliser les Repositories

## Fichiers créés

### Phase 1
- `src/features/transactions/api/transactionApi.ts`
- `src/features/transactions/hooks/useTransactions.ts`
- `src/features/transactions/index.ts`
- `supabase/functions/_shared/repositories/TransactionRepository.ts`

### Phase 2
- `src/features/categories/api/categoryApi.ts`
- `src/features/categories/hooks/useCategories.ts`
- `src/features/categories/index.ts`
- `src/features/invoices/api/invoiceApi.ts`
- `src/features/invoices/hooks/useInvoices.ts`
- `src/features/invoices/index.ts`

### Phase 3
- `src/features/business-plan/api/index.ts` (re-exports all services)
- `src/features/business-plan/api/snapshotApi.ts` (extrait de useBPSnapshots)
- `src/features/business-plan/api/noteApi.ts` (extrait de useBPNotes)

### Fichiers de rétrocompatibilité (re-exports)
- `src/hooks/useTransactions.ts` → re-export depuis `features/transactions`
- `src/hooks/useCategories.ts` → re-export depuis `features/categories`
- `src/hooks/useInvoices.ts` → re-export depuis `features/invoices`
- `src/services/index.ts` → reste en place, importé par `features/business-plan/api/`

## Regles strictes

1. **`supabase.from()`** interdit dans les hooks et composants — uniquement dans les fichiers `api/*.ts`
2. **`toast()`** interdit dans les fichiers `api/` — uniquement dans les hooks
3. **Logique metier** (calculs, validations) dans des fonctions pures, pas dans les hooks ni dans l'API
4. Les Edge Functions ne touchent la DB que via les Repositories

## Prochaines étapes

### Phase 4 : Edge Functions
Créer les repositories manquants et refactorer les fonctions complexes :
- `bridge-sync` → utiliser `TransactionRepository`
- `apply-automation-rule` → utiliser `TransactionRepository`
- `categorize-transaction` → utiliser `TransactionRepository`
- `pennylane-invoices-sync` → utiliser `InvoiceRepository` + `TransactionRepository`
