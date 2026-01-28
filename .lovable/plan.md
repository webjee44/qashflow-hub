
# Plan : Insertion directe des investissements Cloud Vapor

## Objectif

Insérer automatiquement les ~200 investissements issus du tableau d'amortissement dans la base de données pour la société Cloud Vapor.

## Approche technique

1. **Créer une Edge Function temporaire** (`seed-investments`) qui contient toutes les données d'investissements
2. **Appeler cette fonction** pour exécuter l'insertion
3. **Vérifier** que les données sont bien insérées
4. **Supprimer** la fonction temporaire après usage

## Données à insérer

| Catégorie | Nombre d'éléments | Montant total |
|-----------|-------------------|---------------|
| Logiciels (software) | ~30 | ~85 000 € |
| Agencements (fittings) | ~40 | ~180 000 € |
| Matériel industriel (equipment) | ~80 | ~280 000 € |
| Véhicules (vehicle) | ~5 | ~35 000 € |
| Informatique (computer) | ~35 | ~30 000 € |
| Mobilier (furniture) | ~10 | ~8 000 € |
| **TOTAL** | **~200** | **~618 000 €** |

## Fichier à créer

- `supabase/functions/seed-investments/index.ts` - Edge Function d'insertion des données

## Vérification

Après insertion, je lancerai une requête pour confirmer :
- Nombre total d'investissements insérés
- Montant total des investissements
- Répartition par catégorie

