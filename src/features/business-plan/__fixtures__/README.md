# BP Fixtures

## `cloud-vapor.json`

Snapshot du 2026-05-05 des inputs BP de la société Cloud Vapor
(`company_id = 12ea5853-35f4-46d3-a97d-3d8f466e59d8`).

Contenu : `settings`, `business_plan`, `company`, `revenue_streams`,
`variable_expenses`, `fixed_expenses`, `personnel`, `directors`,
`investments`, `financings`, `stocks`, `bonuses`, `scenarios`,
`scenario_overrides`.

Cette fixture sert de cas de référence pour :
- les tests d'invariants (`__tests__/invariants.cloud-vapor.test.ts`),
- la validation de parité entre l'écran et le PDF lors de l'unification
  du moteur (`computeBPModel`).

Mise à jour manuelle uniquement, via le script :

```bash
psql -t -A -c "SELECT json_build_object(...)::text" \
  > src/features/business-plan/__fixtures__/cloud-vapor.json
```

Ne pas modifier à la main.
