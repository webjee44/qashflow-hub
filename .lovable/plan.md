

# Audit de l'espace Démo — Diagnostic

## Compte démo
- **Email** : `demo@demo.fr`
- **User ID** : `2ab6f6c5-7efb-47ba-aede-b6c2b950b679`
- **Organisation** : "demo's Organization" (is_demo = true)
- **Trial** : expire le 19 mars 2026 (OK, pas encore expiré)

## Ce qui fonctionne
| Module | Statut | Détail |
|---|---|---|
| 3 sociétés | OK | CloudSoft (solde initial 150k), StrategiaConseil (40k), ChaussuresPro (25k) |
| Transactions | OK | 127 transactions réparties (48 + 36 + 43), la majorité catégorisée (118/127) |
| Catégories | OK | 25 catégories en place |
| Prévisions catégories | OK | 79 lignes de category_forecasts |
| Business Plans | OK | 3 BP "2026-2028" (un par société) |
| Factures | OK | 25 factures |
| Règles d'automatisation | OK | 15 règles (5 par société) |

## Problèmes identifiés

### 1. CRITIQUE — Profil manquant
Le user `demo@demo.fr` n'a **aucun enregistrement dans la table `profiles`**. Conséquence : l'app tourne en boucle sur l'onboarding ou crashe car les requêtes `.single()` sur profiles retournent une erreur.

**Fix** : Insérer un profil complet via migration SQL :
```sql
INSERT INTO profiles (id, full_name, first_name, last_name, onboarding_completed, onboarding_step)
VALUES ('2ab6f6c5-7efb-47ba-aede-b6c2b950b679', 'Utilisateur Démo', 'Utilisateur', 'Démo', true, 99);
```

### 2. CRITIQUE — Aucun compte bancaire fictif
Les 3 sociétés n'ont **aucun bridge_account** ni **company_bridge_accounts**. L'espace démo repose uniquement sur `initial_balance` pour afficher un solde. Cela signifie :
- Le dashboard montre 0 € de solde bancaire (le hook `useBankBalance` ne trouve rien)
- Les sections "Comptes bancaires" dans les paramètres sont vides
- Pas de nom de banque affiché

**Fix** : Créer des enregistrements fictifs dans `bridge_accounts` et `company_bridge_accounts` pour chaque société avec des soldes cohérents. Utiliser un `bridge_user_uuid` fictif dédié au mode démo.

### 3. MINEUR — Nom d'organisation peu professionnel
L'org s'appelle "demo's Organization" — peu vendeur pour une démo client.

**Fix** : Renommer en "Démo Qashflow" via un UPDATE SQL.

### 4. MINEUR — Transactions anciennes (sept 2025 – fév 2026)
Les transactions datent de septembre 2025 à février 2026. Pour une démo en mars 2026, il n'y a pas de transactions du mois en cours, ce qui rend le dashboard moins impressionnant.

## Plan de correction

### Étape 1 : Créer le profil manquant
Migration SQL pour insérer le profil avec `onboarding_completed = true`.

### Étape 2 : Créer des comptes bancaires fictifs
Pour chaque société, insérer dans `bridge_accounts` un compte fictif (avec un `bridge_user_uuid` dédié "demo") puis le lier dans `company_bridge_accounts`. Soldes proposés :
- CloudSoft : Compte courant BNP — 87 500 €
- StrategiaConseil : Compte courant Société Générale — 52 300 €
- ChaussuresPro : Compte courant Crédit Agricole — 31 200 €

### Étape 3 : Renommer l'organisation
UPDATE pour "Démo Qashflow".

### Étape 4 : Optionnel — Ajouter des transactions récentes
Insérer quelques transactions en mars 2026 pour que le mois en cours ait de l'activité.

Toutes les corrections sont des migrations SQL, aucun changement de code nécessaire.

