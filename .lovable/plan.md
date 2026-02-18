

# Renforcement Qualite : Tests Unitaires + Hygiene Git

## 1. Correction `.gitignore` (Hygiene)

Ajouter `.env` au `.gitignore`. Bien que le fichier ne contienne que des cles publiques (`VITE_` = cles anon visibles dans le bundle JS client de toute facon), c'est une bonne pratique.

**Pourquoi pas de panique :** Les vraies cles sensibles (Stripe, Bridge, Service Role) sont stockees dans les secrets backend, inaccessibles depuis le code source. La cle `VITE_SUPABASE_PUBLISHABLE_KEY` est la cle anon -- elle est **conçue** pour etre publique.

## 2. Setup Testing (Vitest)

Installer et configurer Vitest pour le projet :

- Ajouter les devDependencies : `vitest`, `@testing-library/jest-dom`, `@testing-library/react`, `jsdom`
- Creer `vitest.config.ts` avec alias `@` et environment `jsdom`
- Creer `src/test/setup.ts` pour les matchers DOM
- Mettre a jour `tsconfig.app.json` avec les types Vitest

## 3. Tests Unitaires -- Fonctions Pures

Creer des tests pour les utilitaires critiques qui ne dependent pas de Supabase :

### A. `src/lib/zenfirstParser.test.ts`
Fonctions testables :
- `parseZenfirstMonth("Janvier 2026")` doit retourner `"2026-01-01"`
- `parseZenfirstMonth("février 2025")` doit retourner `"2025-02-01"`
- `parseZenfirstAmount("30 647")` doit retourner `30647`
- `parseZenfirstAmount("-24 802")` doit retourner `-24802`
- `parseZenfirstAmount("1 705,50")` doit retourner `1705.5`
- `parseZenfirstAmount("")` doit retourner `0`
- `parseZenfirstCSV(...)` avec un fichier CSV complet

### B. `src/lib/utils.test.ts`
- Test des fonctions utilitaires (`cn`, formatage, etc.)

### C. `src/features/transactions/api/transactionApi.test.ts` (optionnel)
- Tests avec mock Supabase pour valider la couche API

## 4. Fichiers crees/modifies

| Fichier | Action |
|---|---|
| `.gitignore` | Ajouter `.env` |
| `vitest.config.ts` | Creer |
| `src/test/setup.ts` | Creer |
| `tsconfig.app.json` | Ajouter types vitest |
| `src/lib/zenfirstParser.test.ts` | Creer (~15 tests) |
| `src/lib/utils.test.ts` | Creer (~5 tests) |

## Details techniques

### Configuration Vitest

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

### Exemple de tests zenfirstParser

```typescript
describe('parseZenfirstMonth', () => {
  it('parses "Janvier 2026" to ISO format', () => {
    expect(parseZenfirstMonth('Janvier 2026')).toBe('2026-01-01');
  });
  
  it('handles accented month names', () => {
    expect(parseZenfirstMonth('février 2025')).toBe('2025-02-01');
  });
  
  it('returns null for invalid input', () => {
    expect(parseZenfirstMonth('invalid')).toBeNull();
  });
});

describe('parseZenfirstAmount', () => {
  it('parses French number with spaces', () => {
    expect(parseZenfirstAmount('30 647')).toBe(30647);
  });
  
  it('handles comma decimal separator', () => {
    expect(parseZenfirstAmount('1 705,50')).toBe(1705.5);
  });
  
  it('handles negative values', () => {
    expect(parseZenfirstAmount('-24 802')).toBe(-24802);
  });
  
  it('returns 0 for empty string', () => {
    expect(parseZenfirstAmount('')).toBe(0);
  });
});
```

## Impact

- Zero changement fonctionnel
- Ajout de ~20 tests unitaires sur les fonctions pures critiques
- Infrastructure de test prete pour couvrir progressivement le reste du projet
