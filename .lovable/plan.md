

# Migration finale : derniers fichiers console.* vers logger

## Fichiers restants

9 fichiers avec `console.error` et 1 avec `console.info` a migrer vers `logError` / `logInfo` de `@/lib/logger`.

| Fichier | Occurrences | Type |
|---|---|---|
| `src/hooks/useAuth.tsx` | 2 `console.error` + 5 `console.info` | Auth state |
| `src/hooks/useOrganization.tsx` | 3 `console.error` | CRUD membres |
| `src/hooks/useInvitations.ts` | 1 `console.error` | Invitations |
| `src/features/invoices/hooks/useInvoices.ts` | 5 `console.error` | Factures |
| `src/pages/JoinInvitation.tsx` | 1 `console.error` | Inscription |
| `src/pages/SuperAdmin/OrganizationDetail.tsx` | 2 `console.error` | Impersonation |
| `src/components/settings/DataExportsCard.tsx` | 2 `console.error` | Exports |
| `src/components/settings/ZenfirstImportDialog.tsx` | 6 `console.error` | Import CSV |
| `.gitignore` | -- | Ajouter `.env` |

**Total : 27 remplacements** sur 8 fichiers + 1 correction `.gitignore`.

## Pattern applique

Chaque fichier recoit :
```typescript
import { logError, logInfo } from '@/lib/logger';
```

Puis remplacement direct `console.error(...)` vers `logError(...)` et `console.info(...)` vers `logInfo(...)`.

## Impact

- Zero changement fonctionnel
- **100% des fichiers source** utiliseront le logger centralise
- Aucun `console.*` restant en dehors de `src/lib/logger.ts`

