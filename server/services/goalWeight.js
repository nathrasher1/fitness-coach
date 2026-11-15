/**
 * Goal weight helpers.
 *
 * Historical goals store amountLbs (pounds to lose/gain) plus optional startWeight.
 * The Goals page now uses goal weight as the input. We derive amountLbs from
 * start (or current) weight so existing documents stay valid. No destructive
 * migration is required.
 *
 * Optional additive field targetWeightLbs may be stored when the user saves a
 * goal weight; that needs schema-change approval before a production deploy.
 * Reads always compute a display weight if the field is absent:
 *   lose: startWeight - amountLbs
 *   gain: startWeight + amountLbs
 *   maintain: startWeight or current weight
 */
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computedGoalWeightLbs({ type, amountLbs, startWeight, targetWeightLbs, currentWeightLbs } = {}) {
  const stored = num(targetWeightLbs);
  if (stored != null) return +stored.toFixed(2);
  const start = num(startWeight) != null ? num(startWeight) : num(currentWeightLbs);
  if (start == null) return null;
  const amt = num(amountLbs) || 0;
  if (type === 'lose') return +(start - amt).toFixed(2);
  if (type === 'gain') return +(start + amt).toFixed(2);
  return +start.toFixed(2);
}

function amountLbsFromGoalWeight({ type, goalWeightLbs, startWeight, currentWeightLbs } = {}) {
  if (type === 'maintain') return 0;
  const start = num(startWeight) != null ? num(startWeight) : num(currentWeightLbs);
  const target = num(goalWeightLbs);
  if (start == null || target == null) return null;
  if (type === 'lose') return +Math.max(0, start - target).toFixed(2);
  if (type === 'gain') return +Math.max(0, target - start).toFixed(2);
  return 0;
}

function validateGoalWeight({ type, goalWeightLbs, startWeight, currentWeightLbs } = {}) {
  const start = num(startWeight) != null ? num(startWeight) : num(currentWeightLbs);
  const target = num(goalWeightLbs);
  if (type === 'maintain') return { ok: true };
  if (target == null) return { ok: false, error: 'Enter a goal weight.' };
  if (start == null) return { ok: false, error: 'Add a starting weight or a weigh-in so we can derive the amount to lose or gain.' };
  if (type === 'lose' && target >= start) return { ok: false, error: 'Goal weight must be below starting weight to lose.' };
  if (type === 'gain' && target <= start) return { ok: false, error: 'Goal weight must be above starting weight to gain.' };
  return { ok: true };
}

module.exports = { computedGoalWeightLbs, amountLbsFromGoalWeight, validateGoalWeight, num };
