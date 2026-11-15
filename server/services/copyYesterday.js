const MEALS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

function isMeal(meal) {
  return MEALS.includes(meal);
}

function logFingerprint(log) {
  return [
    log.meal,
    String(log.food || ''),
    String(log.foodName || ''),
    Number(log.servings),
    Number(log.calories),
    log.amount == null || log.amount === '' ? '' : Number(log.amount),
    String(log.amountUnit || ''),
    log.isManual ? '1' : '0'
  ].join('|');
}

function selectSourceLogs(sourceLogs, meal) {
  const list = Array.isArray(sourceLogs) ? sourceLogs : [];
  if (!meal) return list.slice();
  return list.filter((l) => l.meal === meal);
}

/** Source entries that do not already exist on the target day (same meal + food + amounts). */
function logsToCopy(sourceLogs, existingTargetLogs, meal) {
  const src = selectSourceLogs(sourceLogs, meal);
  const have = new Set((existingTargetLogs || []).map(logFingerprint));
  return src.filter((l) => !have.has(logFingerprint(l)));
}

function toCreateFields(userId, targetDate, src) {
  return {
    user: userId,
    date: targetDate,
    meal: src.meal,
    food: src.food || undefined,
    foodName: src.foodName,
    servings: src.servings,
    amount: src.amount != null ? src.amount : null,
    amountUnit: src.amountUnit || '',
    amountLabel: src.amountLabel || '',
    calories: src.calories,
    protein: src.protein,
    carbs: src.carbs,
    fat: src.fat,
    fiber: src.fiber,
    note: src.note || '',
    isManual: !!src.isManual
  };
}

function copyResult({ sourceLogs, existingTargetLogs, meal, sourceDate, targetDate }) {
  const sourceForMeal = selectSourceLogs(sourceLogs, meal);
  if (!sourceForMeal.length) {
    const label = meal || 'the day';
    return {
      empty: true,
      alreadyCopied: false,
      copied: 0,
      sourceDate,
      targetDate,
      meal: meal || null,
      message: meal
        ? `Nothing logged for ${meal} yesterday`
        : `No food logged on ${sourceDate}`
    };
  }
  const toCreate = logsToCopy(sourceLogs, existingTargetLogs, meal);
  if (!toCreate.length) {
    return {
      empty: false,
      alreadyCopied: true,
      copied: 0,
      sourceDate,
      targetDate,
      meal: meal || null,
      message: 'Already copied from yesterday'
    };
  }
  return {
    empty: false,
    alreadyCopied: false,
    copied: toCreate.length,
    sourceDate,
    targetDate,
    meal: meal || null,
    docs: toCreate
  };
}

module.exports = {
  MEALS,
  isMeal,
  logFingerprint,
  selectSourceLogs,
  logsToCopy,
  toCreateFields,
  copyResult
};
