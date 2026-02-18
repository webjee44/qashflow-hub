

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

## Strategie : Refactoring progressif en 4 phases

Refactorer tout d'un coup serait risque. On procede par domaine metier, en commencant par les plus critiques.

---

### Phase 1 : Transactions (fondation)

Le domaine le plus utilise. On pose le pattern de reference ici.

**Fichiers a creer :**

```text
src/
  features/
    transactions/
      api/
        transactionApi.ts        --> Seul fichier avec supabase.from('transactions')
      hooks/
        useTransactions.ts       --> React Query, appelle transactionApi
      components/
        TransactionsView.tsx     --> UI pure (deja existant, a deplacer)
        TransactionRow.tsx
        ...
```

**Backend :**

```text
supabase/functions/_shared/
  repositories/
    TransactionRepository.ts     --> Classe avec findById, createMany, softDelete
  services/
    TransactionService.ts        --> Logique metier (split, bulk categorize)
```

**Travail concret :**
1. Creer `src/features/transactions/api/transactionApi.ts` en extrayant tous les appels Supabase de `useTransactions.ts`
2. Simplifier `useTransactions.ts` pour qu'il appelle uniquement `transactionApi`
3. Deplacer les composants transactions dans `src/features/transactions/components/`
4. Creer `TransactionRepository.ts` dans `_shared/repositories/` pour les Edge Functions qui manipulent des transactions

---

### Phase 2 : Categories + Invoices

Meme pattern applique aux categories (661 lignes de hook a nettoyer) et factures.

**Fichiers a creer :**

```text
src/features/
  categories/
    api/categoryApi.ts
    hooks/useCategories.ts       --> Simplifie
    components/                  --> Existants deplaces depuis src/components/categories/
  invoices/
    api/invoiceApi.ts
    hooks/useInvoices.ts
    components/
```

---

### Phase 3 : Business Plan

Le domaine BP a deja des services (`src/services/`). On les renomme en `api/` et on reorganise.

```text
src/features/business-plan/
  api/                           --> Renommer depuis src/services/ existants
    businessPlanApi.ts
    revenueStreamApi.ts
    fixedExpenseApi.ts
    ...
  hooks/                         --> Existants, simplifies
  components/                    --> Existants
  charts/                        --> Existants
```

---

### Phase 4 : Edge Functions (Backend)

Creer la couche Repository partagee pour toutes les Edge Functions.

```text
supabase/functions/_shared/
  repositories/
    TransactionRepository.ts
    InvoiceRepository.ts
    CategoryRepository.ts
    BusinessPlanRepository.ts
  services/
    SyncService.ts
    AutomationService.ts
```

Refactorer les Edge Functions les plus complexes :
- `bridge-sync` (la plus grosse)
- `pennylane-invoices-sync`
- `apply-automation-rule`
- `categorize-transaction`

---

## Regles strictes a respecter

1. **`supabase.from()`** interdit dans les hooks et composants -- uniquement dans les fichiers `api/*.ts`
2. **`toast()`** interdit dans les fichiers `api/` -- uniquement dans les hooks
3. **Logique metier** (calculs, validations) dans des fonctions pures, pas dans les hooks ni dans l'API
4. Les Edge Functions ne touchent la DB que via les Repositories

## Details techniques

### Exemple concret : transactionApi.ts

```typescript
// src/features/transactions/api/transactionApi.ts
import { supabase } from '@/integrations/supabase/client';

export const transactionApi = {
  getByCompany: async (companyId: string, limit?: number) => {
    let q = supabase.from('transactions').select('*')
      .is('deleted_at', null)
      .eq('company_id', companyId)
      .order('date', { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  updateCategory: async (id: string, categoryId: string | null) => {
    const { error } = await supabase.from('transactions')
      .update({ category_id: categoryId }).eq('id', id);
    if (error) throw error;
  },

  bulkUpdateCategory: async (ids: string[], categoryId: string | null) => {
    const { error } = await supabase.from('transactions')
      .update({ category_id: categoryId }).in('id', ids);
    if (error) throw error;
  },
  // ...
};
```

### Exemple : useTransactions.ts simplifie

```typescript
// src/features/transactions/hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionApi } from '../api/transactionApi';
import { useCompany } from '@/hooks/useCompany';
import { logError } from '@/lib/logger';

export function useTransactions(options = {}) {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['transactions', currentCompany?.id, options.limit],
    queryFn: () => transactionApi.getByCompany(currentCompany!.id, options.limit),
    enabled: !!currentCompany?.id,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, categoryId }) => transactionApi.updateCategory(id, categoryId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    onError: (err) => logError('Error updating category:', err),
  });

  return { transactions: query.data || [], isLoading: query.isLoading, updateCategory };
}
```

### Backend Repository

```typescript
// supabase/functions/_shared/repositories/TransactionRepository.ts
import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export class TransactionRepository {
  constructor(private client: SupabaseClient) {}

  async findByCompany(companyId: string) {
    const { data, error } = await this.client
      .from('transactions').select('*')
      .eq('company_id', companyId).is('deleted_at', null);
    if (error) throw error;
    return data;
  }

  async upsertMany(transactions: any[]) {
    const { error } = await this.client
      .from('transactions').upsert(transactions);
    if (error) throw error;
  }
}
```

## Ordre d'execution recommande

Je recommande de commencer par la **Phase 1 (Transactions)** qui pose le pattern de reference. Une fois valide, on enchaine les phases suivantes. Chaque phase est independante et deployable separement.

## Impact

- **Zero changement fonctionnel** -- refactoring pur
- **Zero migration DB** -- seul le code applicatif change
- **Retrocompatibilite** -- les imports existants peuvent etre re-exportes depuis les nouveaux chemins

