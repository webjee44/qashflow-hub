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

const normalizeText = (value: string) => value.trim().toUpperCase();

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

const matchesTextCondition = (
  fieldValue: string,
  operator: string,
  conditionValue: string,
): boolean => {
  const normalizedField = normalizeText(fieldValue);
  const normalizedCondition = normalizeText(conditionValue);

  switch (operator) {
    case 'contains':
      return normalizedField.includes(normalizedCondition);
    case 'equals':
      return normalizedField === normalizedCondition;
    case 'starts_with':
      return normalizedField.startsWith(normalizedCondition);
    case 'ends_with':
      return normalizedField.endsWith(normalizedCondition);
    default:
      return false;
  }
};

const matchesAmountCondition = (
  amount: number,
  operator: string,
  conditionValue: string,
): boolean => {
  if (operator === 'between') {
    try {
      const parsed = JSON.parse(conditionValue) as { min: number; max: number };
      return amount >= parsed.min && amount <= parsed.max;
    } catch {
      return false;
    }
  }

  const value = Number.parseFloat(conditionValue);
  if (Number.isNaN(value)) {
    return false;
  }

  switch (operator) {
    case 'equals':
      return Math.abs(amount - value) < 0.01;
    case 'greater_than':
      return amount > value;
    case 'less_than':
      return amount < value;
    default:
      return false;
  }
};

const matchesCondition = (
  condition: AutomationRuleConditionLike,
  transaction: TransactionLike,
): boolean => {
  switch (condition.condition_field) {
    case 'description':
      return matchesTextCondition(transaction.description, condition.condition_operator, condition.condition_value);
    case 'type':
      return matchesTextCondition(transaction.type, condition.condition_operator, condition.condition_value);
    case 'amount':
      return matchesAmountCondition(Number(transaction.amount), condition.condition_operator, condition.condition_value);
    default:
      return false;
  }
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

  return getRuleConditions(rule).every((condition) => matchesCondition(condition, transaction));
};

export const hasMatchingActiveCategorizationRule = (
  rules: AutomationRuleLike[],
  transaction: TransactionLike,
  targetCategoryId: string | null,
): boolean => rules.some((rule) => isMatchingActiveCategorizationRule(rule, transaction, targetCategoryId));