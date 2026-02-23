

# Plan correctif : Limiter l'import des transactions a 3 mois avant la creation du compte

## Probleme actuel

L'API Bridge renvoie tout l'historique disponible par la banque (parfois plus de 2 ans). Aucun filtre cote serveur ne limite les donnees importees. Resultat :

| Entreprise | Creee le | Transaction la plus ancienne | Ecart |
|---|---|---|---|
| E-fumeur Internet | 12 jan 2026 | 6 nov 2024 | 14 mois |
| Coachflix | 18 jan 2026 | 16 fev 2024 | 23 mois |
| Tradeflix | 18 jan 2026 | 31 dec 2023 | 25 mois |

Cela gonfle la base de donnees inutilement (2 737 transactions pour E-fumeur seul).

## Solution

Filtrer les transactions **en amont** dans les 3 points d'entree du sync, en se basant sur la date de creation de la company (`created_at`). Seules les transactions dont la date est >= `created_at - 3 mois` seront importees.

## Points d'intervention (3 fichiers)

### 1. `bridge-client.ts` - Methode `fetchAllTransactions`

Ajouter un parametre optionnel `cutoffDate` (date ISO string). Si fourni, filtrer les transactions retournees pour ne garder que celles dont `date >= cutoffDate`.

Actuellement le filtre `sinceDays` est passe a l'API Bridge via le parametre `since`, mais Bridge ne le respecte pas toujours (il renvoie plus). Le filtre cote client en memoire est donc indispensable.

### 2. `bridge-sync/index.ts` - Sync manuelle et CRON

Avant d'appeler `fetchAllTransactions`, calculer la date plancher :

```text
cutoffDate = company.created_at - 3 mois
```

Passer cette date a `fetchAllTransactions` et/ou filtrer dans `syncCompanyTransactions` avant d'inserer.

**2 endroits concernes :**
- Ligne ~449 : `cron-sync` (`fetchAllTransactions(90)`)
- Ligne ~585 : `full-sync` (`fetchAllTransactions(90)`)

### 3. `bridge-webhook/index.ts` - Webhook incremental

Dans `handleAccountUpdated`, appliquer le meme filtre : ne pas inserer les transactions dont la date est anterieure a `company.created_at - 3 mois`.

### 4. Nettoyage des donnees existantes (migration SQL)

Supprimer les transactions deja importees qui sont anterieures a la date plancher de chaque company :

```text
DELETE FROM transactions t
USING companies c
WHERE t.company_id = c.id
  AND t.source = 'bridge'
  AND t.date < (c.created_at - interval '3 months')::date
  AND t.deleted_at IS NULL;
```

## Details techniques

### Modification de `fetchAllTransactions` dans `bridge-client.ts`

- Ajouter un parametre `cutoffDate?: string`
- Apres le fetch, filtrer : `transaction.date >= cutoffDate`
- Le parametre `since` de l'API Bridge sera aussi mis a jour pour utiliser `cutoffDate` si elle est plus recente que `sinceDays`

### Modification de `syncCompanyTransactions` dans `bridge-sync/index.ts`

- Recevoir le `created_at` de la company en parametre
- Calculer `cutoff = new Date(created_at); cutoff.setMonth(cutoff.getMonth() - 3)`
- Filtrer les transactions avant le traitement (avant la boucle d'insert/update)

### Modification de `handleAccountUpdated` dans `bridge-webhook/index.ts`

- Recuperer `created_at` de la company en plus de `user_id`
- Filtrer les transactions recues avant l'upsert

### Migration SQL

- Supprimer les transactions Bridge existantes anterieures a `company.created_at - 3 mois`
- Estimer : environ 500-1000 lignes a supprimer

## Impact

- Reduction immediate de la base de donnees (suppression des vieilles transactions)
- Arret de l'importation de donnees trop anciennes a chaque sync
- Aucun impact sur le frontend (les transactions supprimees ne sont probablement pas utilisees)
- Le parametre "3 mois" est facilement ajustable si besoin

