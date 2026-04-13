export interface AutomationRuleConditionLikeCore {
  condition_field: string;
  condition_operator: string;
  condition_value: string;
}

export interface TransactionLikeCore {
  amount: number | string;
  description: string;
  type: string;
  bank_account_name?: string | null;
}

export const normalizeMatchableText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

const matchesContainsCondition = (
  normalizedField: string,
  normalizedCondition: string,
): boolean => {
  if (!normalizedCondition) {
    return false;
  }

  const tokens = normalizedCondition.split(' ').filter(Boolean);

  if (tokens.length <= 1) {
    return normalizedField.includes(normalizedCondition);
  }

  let searchStart = 0;

  for (const token of tokens) {
    const matchIndex = normalizedField.indexOf(token, searchStart);

    if (matchIndex === -1) {
      return false;
    }

    searchStart = matchIndex + token.length;
  }

  return true;
};

export const matchesTextCondition = (
  fieldValue: string,
  operator: string,
  conditionValue: string,
): boolean => {
  const normalizedField = normalizeMatchableText(fieldValue);
  const normalizedCondition = normalizeMatchableText(conditionValue);

  if (!normalizedCondition) {
    return false;
  }

  switch (operator) {
    case 'contains':
      return matchesContainsCondition(normalizedField, normalizedCondition);
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

export const matchesAmountCondition = (
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

export const matchesAutomationCondition = (
  condition: AutomationRuleConditionLikeCore,
  transaction: TransactionLikeCore,
): boolean => {
  switch (condition.condition_field) {
    case 'description':
      return matchesTextCondition(
        transaction.description,
        condition.condition_operator,
        condition.condition_value,
      );
    case 'type':
      return matchesTextCondition(
        transaction.type,
        condition.condition_operator,
        condition.condition_value,
      );
    case 'amount':
      return matchesAmountCondition(
        Math.abs(Number(transaction.amount)),
        condition.condition_operator,
        condition.condition_value,
      );
    case 'bank_account_name':
      // Simple exact match on bank account name
      return (transaction.bank_account_name || '') === condition.condition_value;
    default:
      return false;
  }
};
