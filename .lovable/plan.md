

## Edge Function `check-clients`

### Objectif

Pont entre Prospector et Qashflow : recevoir un batch d'emails, identifier lesquels correspondent a des utilisateurs existants, et retourner leurs infos organisation.

### Donnees cles

- `profiles` ne contient **pas** d'email — l'email est dans `auth.users`
- La jointure est : `auth.users` (email) → `organization_members` (user_id) → `organizations` (name, subscription_status, created_at)
- Le service role key permet de lire `auth.users` via l'API admin

### Architecture

**Fichier unique** : `supabase/functions/check-clients/index.ts`

**Flux** :
1. Valider le body avec Zod (`emails`: array de strings, `secret`: string)
2. Comparer `secret` contre `Deno.env.get("BRIDGE_SECRET")` — 401 si mismatch
3. Via `supabaseAdmin.auth.admin.listUsers()`, recuperer tous les users puis filtrer par emails (lowercase match). Alternative plus efficace : query directe sur `auth.users` via le service role client SQL.
4. Pour chaque email trouve, query `organization_members` + `organizations` pour recuperer `name`, `subscription_status`, `created_at`
5. Retourner `{ "clients": { "email": { "org_name", "status", "since" } } }`

**Securite** :
- Pas de JWT utilisateur — auth uniquement via `BRIDGE_SECRET`
- `verify_jwt = false` dans config.toml (deja le pattern du projet)
- `SUPABASE_SERVICE_ROLE_KEY` pour les queries internes
- Validation Zod du payload + limite de taille du batch (max 200 emails)

### Secret a creer

`BRIDGE_SECRET` — via l'outil `add_secret`, valeur random que l'utilisateur partagera avec Prospector.

### Fichiers impactes

| Fichier | Action |
|---------|--------|
| `supabase/functions/check-clients/index.ts` | Creer |
| `supabase/config.toml` | Ajouter bloc `[functions.check-clients]` |

### Detail implementation

```text
POST /check-clients
Body: { "emails": [...], "secret": "xxx" }

1. Zod validation (emails: z.array(z.string().email()).max(200), secret: z.string())
2. if secret !== BRIDGE_SECRET → 401
3. supabaseAdmin query auth.users WHERE email IN (lowercase emails)
4. Pour chaque user trouve → query organization_members → organizations
5. Response 200: { clients: { [email]: { org_name, status, since } } }
```

La query efficace sera une requete SQL directe via le service role client sur `auth.users`, jointure avec `organization_members` et `organizations`, pour eviter le N+1.

