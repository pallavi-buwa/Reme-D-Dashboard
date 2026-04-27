function evaluateCondition(data, condition) {
  const { field, op, value } = condition;
  const fieldValue = data[field];
  switch (op) {
    case 'eq': return String(fieldValue ?? '') === String(value);
    case 'neq': return String(fieldValue ?? '') !== String(value);
    case 'in': return Array.isArray(value) && value.includes(fieldValue);
    case 'contains':
      // Arrays: exact element match; strings: substring match (needed for A/B/C/D categories)
      return Array.isArray(fieldValue)
        ? fieldValue.includes(value)
        : String(fieldValue ?? '').includes(String(value));
    default: return false;
  }
}

function evaluateRouting(data, priority, rules) {
  const enriched = { ...data, priority };
  const sorted = [...rules]
    .filter(r => r.active)
    .sort((a, b) => a.order_index - b.order_index);

  const assignments = [];

  for (const rule of sorted) {
    const block = typeof rule.conditions === 'string'
      ? JSON.parse(rule.conditions)
      : rule.conditions;
    const { operator = 'AND', conditions = [] } = block;
    const matches = operator === 'AND'
      ? conditions.every(c => evaluateCondition(enriched, c))
      : conditions.some(c => evaluateCondition(enriched, c));

    if (matches) {
      assignments.push({
        team: rule.assign_team,
        role: rule.assign_role,
        escalate: rule.escalate === 1 || rule.escalate === true,
        rule_name: rule.name,
      });
    }
  }

  return assignments;
}

module.exports = { evaluateRouting };
