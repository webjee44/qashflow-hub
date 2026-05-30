
# Fiabilisation du prévisionnel Cloud Vapor

Objectif : aligner le prévisionnel sur la réalité observée des 3 derniers mois, **uniquement via des écritures SQL ciblées** sur la société `12ea5853-35f4-46d3-a97d-3d8f466e59d8`. Aucun code applicatif, aucune nouvelle feature.

Périmètre strict : **Cloud Vapor uniquement**. Aucun autre tenant touché. Toutes les écritures sont idempotentes et réversibles (audit_log + snapshot SQL préalable).

---

## Étape 0 — Filet de sécurité (avant toute écriture)

- Export SQL complet (SELECT → COPY) des tables impactées pour Cloud Vapor :
  - `category_forecasts` (toutes lignes company_id = Cloud Vapor)
  - `forecasts` (idem)
  - `categories` (idem)
  - `companies` (ligne Cloud Vapor)
- Sauvegarde dans `bp_snapshots` avec nom `pre-forecast-cleanup-2026-05-30`.
- Recompte des montants attendus (moyenne réelle 3 derniers mois par catégorie) → table temporaire de travail, pas de modification destructive avant validation des chiffres.

---

## Étape A — Nettoyage structurel (cause racine n°1)

A.1 **Recatégoriser « Virement intercompte » en transfert interne**
- Vérifier le nom canonique côté code (`INTERNAL_TRANSFER_CATEGORY_NAME`).
- UPDATE de la `category` cible : `type = 'INTERNAL_TRANSFER'` (ou renommage vers la catégorie système existante selon ce que le code attend — à confirmer par lecture du fichier `categoryConstants`).
- Effet : neutralisation automatique dans les stats (logique déjà en place, cf. mémoire `treasury-internal-transfer-neutralization-logic`).
- ~20 500 €/mois disparaissent des dépenses fantômes.

A.2 **Aligner le point zéro de la trésorerie**
- Si `companies.initial_balance = 0` alors que le solde bancaire consolidé réel est de **-15 573,80 €** au moment du snapshot ledger, mettre à jour `initial_balance` pour refléter la vérité.
- Vérifier d'abord la convention exacte (snapshot date, source de vérité `company_active_bridge_accounts`) avant tout UPDATE — la mémoire `treasury-forecast-ledger-architecture` impose cohérence avec le zero-point snapshot.

A.3 **Audit livré au client** (read-only, pas d'écriture)
- Liste exhaustive des catégories actives sans forecast (les 10 identifiées).
- Liste des mois sans couverture par catégorie.
- Tableau « réel 3 derniers mois vs forecast actuel » par catégorie.

---

## Étape B — Prolongation des forecasts (cause racine n°2)

Les forecasts s'arrêtent en septembre 2026 → divergence exponentielle à partir d'octobre.

B.1 Pour **chaque catégorie ayant un forecast en septembre 2026**, dupliquer la dernière valeur connue sur **octobre, novembre, décembre 2026**.
- Hypothèse explicite : stabilité (pas d'inflation ni de saisonnalité inventée).
- Insertion via `INSERT ... ON CONFLICT DO NOTHING` pour ne pas écraser d'éventuelles saisies manuelles existantes.
- Champ `notes` rempli avec `"Prolongation auto stabilité — 2026-05-30"` pour traçabilité.

B.2 Vérification post-écriture : compter le nombre de mois couverts par catégorie, confirmer qu'aucune ligne n'a écrasé une saisie manuelle.

---

## Étape C — Backfill par moyenne réelle (cause racine n°3)

Pour les **10 catégories actives sans aucun forecast** (Toutatis 81k, Virement intercompte ⚠️ traité en A.1, Chemnovatic 12,9k, Marketing 11,6k, Loyer 8,1k, Coachflix 6,6k, Remboursement clients 4,9k, etc.) :

C.1 Calcul de la moyenne mobile des 3 derniers mois réels (mars, avril, mai 2026) par catégorie, via SQL pur sur `transactions`.

C.2 Création de lignes `category_forecasts` pour **chaque mois de juin 2026 à décembre 2026** (~7 mois) avec ce montant moyen.
- Type respecté (`expense` / `income`) selon la catégorie.
- Champ `notes` : `"Backfill moyenne réelle 3M — 2026-05-30"`.
- Idempotent : ON CONFLICT (company_id, category_id, month) DO NOTHING.

C.3 Cas spéciaux signalés au client (pas d'écriture automatique) :
- Catégories à forte volatilité (écart-type > moyenne) → liste séparée, à valider manuellement.
- Catégories ponctuelles non récurrentes → exclues du backfill.

---

## Étape D — Ajustements ciblés des forecasts sous-estimés

Pour les catégories où le forecast existant est manifestement trop bas (Flavor District 8,4k réel vs 6k forecast, BPGO 3,3k vs 1,1k, Retraite 4,5k vs 2,5k) :

D.1 UPDATE des `category_forecasts` futurs (à partir de juin 2026) pour aligner sur la moyenne réelle 3M.
D.2 Anciens mois (passés) **non touchés** — l'historique de prévision reste auditables.

---

## Étape E — Vérification finale

- Recalcul SQL : `Opening + Σ Net forecast` mois par mois → s'assurer que la courbe ne grimpe plus mécaniquement.
- Comparaison réel vs forecast sur les 3 derniers mois → écart cible < 15%.
- Livraison au client d'un rapport markdown :
  - Snapshot ID de rollback
  - Liste des écritures effectuées (table, count, montant total)
  - Catégories volatiles non traitées (action manuelle requise)
  - Graphique avant/après (texte ASCII)

---

## Détails techniques

- **Tables touchées** : `category_forecasts` (INSERT + UPDATE), `categories` (UPDATE 1 ligne pour A.1), `companies` (UPDATE 1 ligne pour A.2), `bp_snapshots` (INSERT pour rollback).
- **Outil utilisé** : `supabase--insert` (pas de migration, pas de schéma touché).
- **Scope** : `WHERE company_id = '12ea5853-35f4-46d3-a97d-3d8f466e59d8'` sur chaque requête, sans exception.
- **Réversibilité** : snapshot pré-modification + suffixe `notes` daté pour pouvoir DELETE ciblé si rollback partiel.
- **Non couvert volontairement** : aucune création de catégorie, aucun changement d'architecture, aucune modification de code TS/React, aucun ajout de feature « forecast coverage quality » (sera proposé séparément en PR6 si validé).

---

## Points qui nécessitent ta validation avant exécution

1. Confirmer le nom exact de la catégorie système de transfert interne (je le lirai dans le code avant d'écrire).
2. Confirmer la date snapshot du zero-point pour ajuster `initial_balance` correctement.
3. Valider l'hypothèse « moyenne 3 mois » pour le backfill (vs 6 mois, ou mois courant uniquement).
4. Valider la prolongation par simple duplication (vs avec un coefficient de croissance/inflation).
