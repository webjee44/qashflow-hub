## Contexte

- Société cible : **Vapostore Vannes** (`a10b3af4-…`) — seule société "Vannes" en base.
- Source : PDF "Cloud Vapor" du 5 mai 2026 (3 ans, 2026-2028, IR/PME, IS, trésorerie initiale 0).
- Stratégie validée : **compléter sans écraser**. On garde les lignes existantes et on ajoute des lignes "Autres / complément" pour couvrir les écarts vs PDF.

## Diagnostic existant vs PDF

| Bloc | Existant Vapostore Vannes | PDF Cloud Vapor (an 1) | Action |
|---|---|---|---|
| Settings | 2 lignes (doublon), `bp_start_date=2025-09-01`, exercice sept→août, IS, PME, 24 mois, cash 0, payment 30/15 | IS, PME, 30/30, cash 0 | Aligner délai fournisseur 15→30 sur la ligne active. Pas de suppression du doublon (hors scope). |
| Revenus | 1 stream "Ventes BtC" variable, 17 forecasts éparses (sum 465 k€) | 3 004 678 € / 3 006 180 € / 3 007 683 € | Upsert forecasts mensuels (36 mois, Sep-25→Aug-28) à 250 390 / 250 515 / 250 640 €/mois. |
| Charges variables | 50 % achats + 4,5 % redevance + 0,7 % TPE = 55,2 % du CA (~1,66 M€) | 1 421 814 € (47,3 %) | **Aucun ajout** (déjà supérieur au PDF, on garde). |
| Services extérieurs | — | 446 793 €/an | Ajout 1 ligne fixe "Autres services extérieurs (complément BP)" 37 233 €/mois, catégorie `services_exterieurs`, TVA 20 %. |
| Charges fixes | Loyer 1 607 €/mois (19 284 €/an) | 695 628 €/an | Ajout 1 ligne fixe "Autres charges fixes (complément BP)" 56 362 €/mois, catégorie `other`, TVA 20 %. |
| Impôts & taxes | — | 14 756 €/an | Ajout 1 ligne fixe "Impôts et taxes (CFE/CVAE)" 1 230 €/mois, catégorie `taxes`, non déductible TVA. |
| Personnel | Typhen 2 452 € + Marvin 2 116 € + Benjamin freelance 0 = ~74 k€/an chargé | 222 329 €/an | Ajout 1 personnel "Effectif complémentaire (BP)" salaire brut 9 149 €/mois, charges 35,07 %, CDI, employee. |
| Investissements | Caisse 2 000 € (3 ans) | 30 000 € (an 1) | Ajout 1 investissement "Autres immobilisations (complément BP)" 28 000 €, amort. 5 ans, date 2025-09-01. |
| Financements | Crédit Mutuel 100 k€ | aucun nouvel emprunt | Rien. |
| Stocks | — | — | Rien (ecommerce/retail, pas de stock dans PDF). |
| Capital initial | non renseigné (`initial_capital` NULL) | non explicite | Rien (le PDF ne donne pas de capital social). |

## Plan d'action

### Étape 1 — Migration SQL (un seul `migration` call)

Insertions ciblées sur `company_id = a10b3af4-…`, `user_id = cb5d33be-…`, `business_plan_id = NULL` (cohérent avec l'existant) :

1. **bp_fixed_expenses** : 3 INSERT
   - Autres services extérieurs — 37 233 €/mois — `services_exterieurs` — TVA 20 % déductible
   - Autres charges fixes (complément BP) — 56 362 €/mois — `other` — TVA 20 % déductible
   - Impôts et taxes (CFE/CVAE) — 1 230 €/mois — `taxes` — non déductible
   - `start_date = 2025-09-01`, `payment_frequency = monthly`, `end_date = NULL`
2. **bp_personnel** : 1 INSERT
   - "Effectif complémentaire (BP)", `gross_salary=9149`, `employer_charges_rate=0.3507`, `contract_type=cdi`, `worker_type=employee`, `start_date=2025-09-01`
3. **bp_investments** : 1 INSERT
   - "Autres immobilisations (complément BP)", `purchase_amount=28000`, `depreciation_years=5`, `category=equipment`, `purchase_date=2025-09-01`
4. **bp_revenue_forecasts** : UPSERT 36 mois pour le stream `d455c1c3-…`
   - Sep-25 → Aug-26 : 250 390 €/mois
   - Sep-26 → Aug-27 : 250 515 €/mois
   - Sep-27 → Aug-28 : 250 640 €/mois
   - `ON CONFLICT (stream_id, month)` → DO UPDATE (préserver les ids existants)
5. **bp_settings** : UPDATE `supplier_payment_delay = 30` sur la ligne `a17cd37c-…` (alignement avec PDF). On ne touche pas à la 2e ligne (doublon hors scope).

### Étape 2 — Vérification

- Requête SQL de contrôle agrégée (sommes annuelles par bloc) → comparer aux totaux PDF avec tolérance ±2 %.
- Pas de modification UI / code applicatif. Tout passe par le moteur BP existant qui recalculera les agrégats.

## Détails techniques

- Aucune table créée, aucune colonne ajoutée — uniquement des INSERT/UPDATE de données métier.
- Conformément à la mémoire projet "Strict single BP per company" : on ne corrige pas le doublon `bp_settings` ici (il préexistait, hors scope).
- `bp_revenue_forecasts` n'a pas de contrainte unique visible sur `(stream_id, month)` ; je vérifierai et utiliserai soit `ON CONFLICT` si l'index existe, soit DELETE + INSERT pour les 36 mois ciblés du stream.
- Toutes les valeurs viennent du PDF — aucun chiffre inventé en dehors du calcul mécanique du complément (PDF − existant).

## Hors scope (à traiter séparément si tu veux)

- Déduplication des `bp_settings`.
- Renseignement d'un `initial_capital` réaliste (le PDF n'en donne pas, je refuse d'inventer).
- Création d'un `business_plan` formel (`business_plans` row) — l'existant fonctionne sans.
