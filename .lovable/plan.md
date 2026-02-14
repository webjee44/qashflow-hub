
# Empêcher la creation de Business Plans en doublon

## Probleme identifie

Le hook `useCurrentBusinessPlan` auto-cree un BP quand il n'en trouve pas. En React StrictMode (ou lors de re-renders rapides), l'effet peut se declencher deux fois avant que le `isCreatingRef` ne soit verifie, causant des doublons.

Deux causes racines :
1. **Cote client** : `createBusinessPlan` est dans le tableau de dependances du `useEffect`, ce qui peut relancer l'effet inutilement.
2. **Cote base de donnees** : Aucune contrainte d'unicite n'empeche d'inserer 2 BP pour la meme company.

## Plan de correction

### 1. Contrainte unique en base de donnees (filet de securite)

Ajouter une contrainte unique partielle sur `business_plans(company_id)` pour qu'une company ne puisse avoir qu'un seul BP actif :

```sql
CREATE UNIQUE INDEX unique_bp_per_company 
ON business_plans (company_id) 
WHERE company_id IS NOT NULL;
```

Cela empechera tout doublon au niveau base, peu importe ce que fait le client.

### 2. Correction du hook useCurrentBusinessPlan

- Retirer `createBusinessPlan` du tableau de dependances (il change a chaque render).
- Utiliser une ref stable pour la mutation.
- Ajouter une verification supplementaire avec `currentCompany?.id` pour ne creer que quand la company est chargee.

### 3. Gestion de l'erreur de conflit

Dans le `onError` de la mutation, ignorer silencieusement l'erreur de contrainte unique (code `23505`) car cela signifie simplement qu'un autre render a deja cree le BP.

---

## Details techniques

**Fichiers modifies :**
- `supabase/migrations/` -- nouvelle migration pour l'index unique
- `src/features/business-plan/hooks/useCurrentBusinessPlan.ts` -- correction du hook

**Impact :** Aucun impact sur les donnees existantes (le doublon a deja ete supprime). La contrainte empechera toute recurrence.
