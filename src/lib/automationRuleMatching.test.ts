import { describe, expect, it } from 'vitest';
import { hasMatchingActiveCategorizationRule, matchesTextCondition } from './automationRuleMatching';

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

  it('matches multi-word contains conditions even with filler banking words in between', () => {
    expect(matchesTextCondition('Rem Prlv Webjee', 'contains', 'Rem Webjee')).toBe(true);
    expect(matchesTextCondition('Webjee Rem', 'contains', 'Rem Webjee')).toBe(false);
  });

  it('detects an existing rule when the matching words are non-contiguous', () => {
    expect(
      hasMatchingActiveCategorizationRule(
        [
          {
            condition_field: 'description',
            condition_operator: 'contains',
            condition_value: 'REM WEBJEE',
            target_category_id: 'cat-sales',
            action_type: 'categorize',
            is_active: true,
          },
        ],
        {
          description: 'REM PRLV WEBJEE',
          amount: 3042.54,
          type: 'income',
        },
        'cat-sales',
      ),
    ).toBe(true);
  });
});