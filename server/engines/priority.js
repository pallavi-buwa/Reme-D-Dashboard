function evaluateCondition(data, condition) {
  const { field, op, value } = condition;
  const fieldValue = data[field];

  switch (op) {
    case 'eq':
      return String(fieldValue ?? '') === String(value);
    case 'neq':
      return String(fieldValue ?? '') !== String(value);
    case 'contains':
      return Array.isArray(fieldValue)
        ? fieldValue.includes(value)
        : String(fieldValue ?? '').includes(String(value));
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'truthy':
      return !!fieldValue;
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    default:
      return false;
  }
}

function evaluateRuleBlock(data, block) {
  const { operator = 'AND', conditions = [] } = block;
  if (!conditions.length) return false;
  return operator === 'AND'
    ? conditions.every(c => evaluateCondition(data, c))
    : conditions.some(c => evaluateCondition(data, c));
}

function evaluatePriority(data, rules) {
  const sorted = [...rules]
    .filter(r => r.active)
    .sort((a, b) => a.order_index - b.order_index);

  for (const rule of sorted) {
    const block = typeof rule.conditions === 'string'
      ? JSON.parse(rule.conditions)
      : rule.conditions;

    if (evaluateRuleBlock(data, block)) {
      return {
        priority: rule.result_priority,
        reasoning: rule.reasoning || rule.name,
        rule_name: rule.name,
        rule_id: rule.id,
      };
    }
  }

  return {
    priority: 'P3',
    reasoning: 'No specific rule matched — assigned default priority.',
    rule_name: 'Default',
    rule_id: null,
  };
}

module.exports = { evaluatePriority };
