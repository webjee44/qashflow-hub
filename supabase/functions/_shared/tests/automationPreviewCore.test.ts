import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computePreview, type PreviewTransaction, type PreviewExistingRule } from "../automationPreviewCore.ts";

const txs: PreviewTransaction[] = [
  { id: '1', description: 'CARTE AMAZON EU 1234', amount: 19.99, type: 'expense', category_id: null },
  { id: '2', description: 'AMAZON EU SARL', amount: 32.5, type: 'expense', category_id: 'cat-amazon' },
  { id: '3', description: 'AMAZON PRIME', amount: 6.99, type: 'expense', category_id: 'cat-amazon' },
  { id: '4', description: 'AMAZON FRESH', amount: 45, type: 'expense', category_id: 'cat-other' },
  { id: '5', description: 'NETFLIX', amount: 13.49, type: 'expense', category_id: null },
  { id: '6', description: 'AMAZON RBS', amount: 200, type: 'income', category_id: null },
];

Deno.test("computePreview - basic counts and distribution", () => {
  const result = computePreview(
    {
      conditions: [
        { condition_field: 'description', condition_operator: 'contains', condition_value: 'AMAZON' },
      ],
      target_category_id: 'cat-amazon',
      target_category_type: 'expense',
    },
    txs,
  );

  assertEquals(result.matched_total, 5); // tx 6 also matches but flagged type_mismatch (still counted in total)
  assertEquals(result.type_mismatch_count, 1);
  assertEquals(result.matched_uncategorized, 1); // tx 1
  assertEquals(result.same_category_count, 2);   // tx 2, 3
  assertEquals(result.other_category_count, 1);  // tx 4
  assertEquals(result.matched_already_categorized, 3);
  assertEquals(result.total_amount_impact, 19.99);
  assert(result.warnings.includes('historical_category_conflict'));
  assert(result.warnings.includes('type_mismatch'));
});

Deno.test("computePreview - safety_score drops with short pattern", () => {
  const result = computePreview(
    {
      conditions: [
        { condition_field: 'description', condition_operator: 'contains', condition_value: 'AM' },
      ],
      target_category_id: 'cat-amazon',
    },
    txs,
  );
  assert(result.warnings.includes('pattern_too_short'));
  assert(result.safety_score < 0.8);
});

Deno.test("computePreview - detects overlapping rules", () => {
  const others: PreviewExistingRule[] = [
    {
      id: 'r-other',
      name: 'AMAZON Prime',
      target_category_id: 'cat-other',
      conditions: [
        { condition_field: 'description', condition_operator: 'contains', condition_value: 'AMAZON' },
      ],
    },
  ];
  const result = computePreview(
    {
      conditions: [
        { condition_field: 'description', condition_operator: 'contains', condition_value: 'AMAZON' },
      ],
      target_category_id: 'cat-amazon',
      target_category_type: 'expense',
    },
    txs,
    others,
  );
  assertEquals(result.conflicts_with_other_rules.length, 1);
  assertEquals(result.conflicts_with_other_rules[0].overlap_count, 1); // tx 1 (uncategorized)
  assert(result.warnings.includes('overlapping_rules'));
});

Deno.test("computePreview - ignores rule being edited", () => {
  const others: PreviewExistingRule[] = [
    {
      id: 'r-self',
      name: 'self',
      target_category_id: 'cat-amazon',
      conditions: [
        { condition_field: 'description', condition_operator: 'contains', condition_value: 'AMAZON' },
      ],
    },
  ];
  const result = computePreview(
    {
      conditions: [
        { condition_field: 'description', condition_operator: 'contains', condition_value: 'AMAZON' },
      ],
      target_category_id: 'cat-amazon',
      rule_id_being_edited: 'r-self',
    },
    txs,
    others,
  );
  assertEquals(result.conflicts_with_other_rules.length, 0);
});

Deno.test("computePreview - no matches → moderate safety, no warning", () => {
  const result = computePreview(
    {
      conditions: [
        { condition_field: 'description', condition_operator: 'contains', condition_value: 'NOTHINGMATCHING' },
      ],
      target_category_id: 'cat-amazon',
    },
    txs,
  );
  assertEquals(result.matched_total, 0);
  assertEquals(result.safety_score, 0.5);
});
