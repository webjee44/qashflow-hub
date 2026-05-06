# BP Hooks Audit

Generated: 2026-05-06T03:05:19Z

| Hook | legacy LOC | features LOC | identical? | imports legacy | imports features |
|------|-----------:|-------------:|:----------:|---------------:|-----------------:|
| useBalanceSheet | 270 | 3 | **no** | 7 | 0 |
| useBusinessPlans | 132 | 91 | **no** | 3 | 0 |
| useCurrentBusinessPlan | 81 | 81 | yes | 5 | 0 |
| useDirectors | 167 | 167 | yes | 0 | 0 |
| useFinancings | 253 | 249 | **no** | 3 | 0 |
| useFixedExpenses | 166 | 166 | yes | 0 | 0 |
| useFundingPlan | 247 | 236 | **no** | 1 | 1 |
| useInvestments | 180 | 180 | yes | 5 | 0 |
| usePersonnel | 216 | 215 | **no** | 0 | 0 |
| useProfitLoss | 7 | 41 | **no** | 7 | 1 |
| useRevenueStreams | 314 | 310 | **no** | 6 | 1 |
| useScenarioOverrides | 144 | 144 | yes | 1 | 0 |
| useScenarios | 179 | 179 | yes | 6 | 0 |
| useStocks | 169 | 169 | **no** | 2 | 0 |
| useVariableExpenses | 199 | 199 | **no** | 5 | 0 |

## Hooks only in src/hooks (no features twin)

## Action plan for PR1

**Verdict per hook**:
- `identical = yes`: safe to dedupe via re-export, then migrate imports.
- `identical = no`: requires manual diff + decision documented in `docs/bp-hook-consolidation.md` BEFORE deduplication. Source of truth = whichever version preserves all behavior used by consumers, ideally re-expressed as a selector on `useBPModel()`.

Order recommended:
1. Delete divergent legacy versions only after content review.
2. Convert each hook to a selector on `useBPModel()` once dedupe is complete.
3. Keep re-export shim in src/hooks/ for one PR, then remove.
