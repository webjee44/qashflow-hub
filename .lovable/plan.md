
# Plan anti-doublons : transactions bancaires

## Le probleme

Il y a **2 911 doublons** dans la base. Cause : les anciennes transactions (2 880) ont ete importees **sans `bridge_transaction_id`**. Quand la synchronisation s'execute a nouveau, elle ne les retrouve pas et en cree de nouvelles avec le bon identifiant.

## Plan en 3 phases

### Phase 1 -- Nettoyage des doublons existants (migration SQL)

1. **Identifier les doublons** : transactions avec meme `description`, `date`, `amount`, `type`, `company_id` ou l'une a `bridge_transaction_id = NULL` et l'autre non.
2. **Transferer les categories** : si l'ancienne ligne (sans bridge_id) avait une `category_id`, la reporter sur la nouvelle (avec bridge_id) pour ne pas perdre le travail de categorisation.
3. **Soft-delete les anciennes lignes** : mettre `deleted_at = now()` sur les lignes sans `bridge_transaction_id` qui ont un doublon.

### Phase 2 -- Backfill des orphelins (migration SQL)

Pour les ~2 880 transactions sans `bridge_transaction_id` qui n'ont **pas** de doublon (cas rare mais possible) :
1. Tenter un matching par `pennylane_id` (format `bridge_XXXX`) pour remplir le `bridge_transaction_id`.
2. Les lignes restantes sans correspondance conservent leur etat actuel -- elles seront protegees par la phase 3.

### Phase 3 -- Protection anti-doublons dans le code de sync

Modifier `supabase/functions/bridge-sync/index.ts` pour ajouter une **troisieme couche de deduplication** :

1. Apres la recherche par `bridge_transaction_id` et `pennylane_id`, faire un **fallback par signature** : `(description, date, amount, type, company_id)`.
2. Si une transaction existante correspond a cette signature, la mettre a jour (et backfill son `bridge_transaction_id`) au lieu d'en creer une nouvelle.
3. Utiliser `upsert` avec `onConflict: 'idx_transactions_bridge_id_company'` pour que la base de donnees bloque tout doublon residuel.

### Phase 4 -- Contrainte de securite en base (migration SQL)

Ajouter un **trigger de validation** sur la table `transactions` :
- Avant INSERT, verifier qu'il n'existe pas deja une transaction avec les memes `(description, date, amount, type, company_id)` non supprimee.
- Si doublon detecte, rejeter l'insertion avec un message d'erreur clair.
- Cela constitue le dernier filet de securite, independant du code applicatif.

## Detail technique

### Migration SQL (Phases 1, 2, 4)

```text
Phase 1 : UPDATE + soft-delete des doublons
  - UPDATE new SET category_id = old.category_id FROM old WHERE match AND old.category_id IS NOT NULL
  - UPDATE old SET deleted_at = now() WHERE has_duplicate_with_bridge_id

Phase 2 : Backfill bridge_transaction_id via pennylane_id
  - UPDATE transactions SET bridge_transaction_id = CAST(REPLACE(pennylane_id, 'bridge_', '') AS BIGINT)
    WHERE bridge_transaction_id IS NULL AND pennylane_id LIKE 'bridge_%'

Phase 4 : Trigger anti-doublon
  - CREATE FUNCTION prevent_duplicate_transaction() RETURNS TRIGGER
  - Verifie l'unicite par signature (description, date, amount, type, company_id)
  - Ignore les lignes soft-deleted
```

### Modification Edge Function (Phase 3)

```text
bridge-sync/index.ts :
  - Ajout d'une recherche par signature (description + date + amount + company_id)
    en complement des lookups par bridge_transaction_id et pennylane_id
  - Si match par signature : update + backfill bridge_transaction_id
  - Si aucun match : insert normal
```

## Fichiers concernes

- `supabase/functions/bridge-sync/index.ts` -- ajout fallback deduplication
- 1 migration SQL -- nettoyage + backfill + trigger

## Resultat attendu

- 0 doublons dans la base apres nettoyage
- Protection a 3 niveaux contre les futurs doublons : code sync, index unique, trigger SQL
- Aucune perte de categorisation
