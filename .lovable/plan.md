

## Objectif

Deux améliorations sur `/superadmin/crm` :
1. **Filtrer les faux inscrits** (noms bidons type "dzd dzdzd", "dda", emails de test)
2. **Afficher le statut de la période d'essai** sur chaque card (jours restants ou "Essai terminé")

---

## Approche

### 1. Enrichir la RPC `get_superadmin_crm_pipeline`

Ajouter 3 colonnes au retour :
- `subscription_status` (text) — depuis `organizations`
- `trial_ends_at` (timestamptz) — depuis `organizations`
- `org_name` (text) — depuis `organizations`

La jointure existe deja implicitement via `organization_members`. On ajoute un LEFT JOIN sur `organizations` dans le CTE `user_data`.

**Migration SQL** : ALTER la function pour inclure ces champs.

### 2. Filtrer les faux inscrits cote client

Plutot que de hardcoder une liste d'emails a exclure (anti-pattern), on applique des heuristiques generalisables :
- Exclure les utilisateurs dont le domaine email est `@cloudvapor.com` (equipe interne) — sauf si souhaite
- Exclure les superadmins (deja implicitement hors pipeline)
- Exclure les noms de moins de 3 caracteres ou composes de caracteres repetitifs (regex)
- Exclure les emails contenant `+` suivi de chiffres (pattern de test type `nixonshop+17@gmail.com`)
- Ajouter un toggle "Afficher les comptes de test" pour ne pas perdre de visibilite

Cela se fait dans le hook `useCRMPipeline` via un filtre configurable.

### 3. Afficher le trial sur les cards

Dans `CompactUserCard`, ajouter un petit badge :
- **Essai actif** : badge jaune "J-X" (jours restants)
- **Essai expiré** : badge rouge "Essai terminé"
- **Abonné** : badge vert "Abonné" (si `subscription_status` = 'active' ou plan = 'lifetime')
- **Pas d'org** : rien

Dans `UserDetailPanel`, ajouter une ligne dans la section Contact avec la date de fin d'essai.

---

## Fichiers impactes

| Fichier | Action |
|---------|--------|
| Migration SQL | Modifier `get_superadmin_crm_pipeline` pour retourner `subscription_status`, `trial_ends_at`, `org_name` |
| `src/hooks/useCRMPipeline.ts` | Ajouter les champs au type `CRMUser`, ajouter filtre faux inscrits + toggle |
| `src/pages/SuperAdmin/CRM.tsx` | Ajouter toggle "comptes de test", afficher badge trial sur `CompactUserCard` et `UserDetailPanel` |

---

## Detail technique

### Heuristique de detection "faux inscrit"

```text
isFakeUser(user):
  - email ends with @cloudvapor.com → test interne
  - email matches /\+\d+@/ → alias de test
  - full_name length < 3 → nom bidon
  - full_name matches /^(.)\1+$/ → repetition (ex: "dda", "dzd dzdzd")
  - email matches /(test|demo|fake)/i → compte de test
```

Un toggle dans l'UI permet d'inclure/exclure ces comptes. Exclus par defaut.

### Badge trial sur les cards

```text
if subscription_status == 'active' || plan == 'lifetime' → "Abonné" (vert)
else if trial_ends_at > now → "J-X" (jaune)  
else if trial_ends_at <= now → "Expiré" (rouge)
else → rien
```

