import { describe, expect, it } from 'vitest';
import { hasMatchingActiveCategorizationRule } from './automationRuleMatching';

describe('automationRuleMatching', () => {
  const transaction = {
    description: 'PRLV SEPA NETFLIX PREMIUM',
    amount: 15.99,
    type: 'expense',
  };

  it('matches an active categorization rule for the same target category', () => {
    expect(
      hasMatchingActiveCategorizationRule(
        [
          {
            condition_field: 'description',
            condition_operator: 'contains',
            condition_value: 'NETFLIX',
            target_category_id: 'cat-streaming',
            action_type: 'categorize',
            is_active: true,
          },
        ],
        transaction,
        'cat-streaming',
      ),
    ).toBe(true);
  });

  it('does not suppress the suggestion for an unrelated rule on another category', () => {
    expect(
      hasMatchingActiveCategorizationRule(
        [
          {
            condition_field: 'description',
            condition_operator: 'contains',
            condition_value: 'PRLV SEPA',
            target_category_id: 'cat-bank-fees',
            action_type: 'categorize',
            is_active: true,
          },
        ],
        transaction,
        'cat-streaming',
      ),
    ).toBe(false);
  });

  it('uses the full condition set when a rule has additional conditions', () => {
    expect(
      hasMatchingActiveCategorizationRule(
        [
          {
            condition_field: 'description',
            condition_operator: 'contains',
            condition_value: 'NETFLIX',
            target_category_id: 'cat-streaming',
            action_type: 'categorize',
            is_active: true,
            conditions: [
              {
                condition_field: 'description',
                condition_operator: 'contains',
                condition_value: 'NETFLIX',
              },
              {
                condition_field: 'amount',
                condition_operator: 'equals',
                condition_value: '15.99',
              },
            ],
          },
        ],
        transaction,
        'cat-streaming',
      ),
    ).toBe(true);

    expect(
      hasMatchingActiveCategorizationRule(
        [
          {
            condition_field: 'description',
            condition_operator: 'contains',
            condition_value: 'NETFLIX',
            target_category_id: 'cat-streaming',
            action_type: 'categorize',
            is_active: true,
            conditions: [
              {
                condition_field: 'description',
                condition_operator: 'contains',
                condition_value: 'NETFLIX',
              },
              {
                condition_field: 'amount',
                condition_operator: 'greater_than',
                condition_value: '20',
              },
            ],
          },
        ],
        transaction,
        'cat-streaming',
      ),
    ).toBe(false);
  });
});