import {
  matchesAutomationCondition,
  matchesTextCondition,
  matchesAmountCondition,
} from '../../shared/automationRuleMatchingCore.ts';

export interface AutomationRuleConditionLike {
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

export interface AutomationRuleLike extends AutomationRuleConditionLike {
  action_type?: string;
  target_category_id: string | null;
  is_active?: boolean;
  conditions?: AutomationRuleConditionLike[];
}

export interface TransactionLike {
  amount: number | string;
  description: string;
  type: string;
}

export { matchesTextCondition, matchesAmountCondition };

const getRuleConditions = (rule: AutomationRuleLike): AutomationRuleConditionLike[] => {
  if (rule.conditions && rule.conditions.length > 0) {
    return rule.conditions;
  }

  return [
    {
      condition_field: rule.condition_field,
      condition_operator: rule.condition_operator,
      condition_value: rule.condition_value,
    },
  ];
};


export const isMatchingActiveCategorizationRule = (
  rule: AutomationRuleLike,
  transaction: TransactionLike,
  targetCategoryId: string | null,
): boolean => {
  if (rule.is_active === false) {
    return false;
  }

  if (rule.action_type && rule.action_type !== 'categorize') {
    return false;
  }

  if (rule.target_category_id !== targetCategoryId) {
    return false;
  }

  return getRuleConditions(rule).every((condition) => matchesAutomationCondition(condition, transaction));
};

export const hasMatchingActiveCategorizationRule = (
  rules: AutomationRuleLike[],
  transaction: TransactionLike,
  targetCategoryId: string | null,
): boolean => rules.some((rule) => isMatchingActiveCategorizationRule(rule, transaction, targetCategoryId));