# BP Hooks Audit

Generated: 2026-05-06T03:04:48Z

Convention: 'imports legacy' = files importing from @/hooks/<X>; 'imports features' = files importing from @/features/business-plan/hooks/<X> (or barrel).

| Hook | legacy LOC | features LOC | identical? | imports legacy | imports features | divergence |
|------|-----------:|-------------:|:----------:|---------------:|-----------------:|------------|
| useBalanceSheet | 270 | 3 | yes | 7 | 0 |  |
| useBusinessPlans | 132 | 91 | yes | 3 | 0 |  |
| useCurrentBusinessPlan | 81 | 81 | yes | 5 | 0 |  |
| useDirectors | 167 | 167 | yes | 0 | 0 |  |
| useFinancings | 253 | 249 | yes | 3 | 0 |  |
| useFixedExpenses | 166 | 166 | yes | 0 | 0 |  |
| useFundingPlan | 247 | 236 | yes | 1 | 1 |  |
| useInvestments | 180 | 180 | yes | 5 | 0 |  |
| usePersonnel | 216 | 215 | yes | 0 | 0 |  |
| useProfitLoss | 7 | 41 | yes | 7 | 1 |  |
| useRevenueStreams | 314 | 310 | yes | 6 | 1 |  |
| useScenarioOverrides | 144 | 144 | yes | 1 | 0 |  |
| useScenarios | 179 | 179 | yes | 6 | 0 |  |
| useStocks | 169 | 169 | yes | 2 | 0 |  |
| useVariableExpenses | 199 | 199 | yes | 5 | 0 |  |

## Hooks ONLY in src/hooks (no features twin)

## Re-exports detected
