import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { AutomationRepository } from '../repositories/AutomationRepository.ts';

function createMockClient() {
  const queriedRuleIdBatches: string[][] = [];

  return {
    queriedRuleIdBatches,
    from(table: string) {
      assertEquals(table, 'automation_rule_conditions');
      return {
        select(_columns: string) {
          return {
            async in(column: string, values: string[]) {
              assertEquals(column, 'rule_id');
              queriedRuleIdBatches.push(values);
              return {
                data: values.map(rule_id => ({
                  rule_id,
                  condition_field: 'description',
                  condition_operator: 'contains',
                  condition_value: rule_id,
                })),
                error: null,
              };
            },
          };
        },
      };
    },
  };
}

Deno.test('AutomationRepository.findConditionsByRuleIds batches large rule lists', async () => {
  const mockClient = createMockClient();
  const repository = new AutomationRepository(mockClient as any);
  const ruleIds = Array.from({ length: 251 }, (_, index) => `rule-${index}`);

  const conditions = await repository.findConditionsByRuleIds(ruleIds);

  assertEquals(conditions.length, 251);
  assertEquals(mockClient.queriedRuleIdBatches.length, 3);
  assertEquals(mockClient.queriedRuleIdBatches.map(batch => batch.length), [100, 100, 51]);
});