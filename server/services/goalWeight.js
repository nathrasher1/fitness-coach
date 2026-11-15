/**
 * Goal weight helpers.
 *
 * Historical goals store amountLbs (pounds to lose/gain) plus optional startWeight.
 * The Goals page now uses goal weight as the input. We derive amountLbs from
 * start (or current) weight so existing documents stay valid. No destructive
 * migration is required.
 *
 * Goal type is inferred from goal weight vs current weight, falling back to
 * starting weight: higher = gain, lower = lose, within 0.5 lb = maintain.
 * The inferred type is still stored so calorie targets and recommendations
 * keep working. Existing goals are not rewritten on read.
 *
 * Optional additive field targetWeightLbs may be stored when the user saves a
 * goal weight. Reads always compute a display weight if the field is absent:
 *   lose: startWeight - amountLbs
 *   gain: startWeight + amountLbs
 *   maintain: startWeight or current weight
 */
const TYPE_TOLERANCE_LBS = 0.5;

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function referenceWeightLbs({ startWeight, currentWeightLbs } = {}) {
  const current = num(currentWeightLbs);
  if (current != null) return current;
  return num(startWeight);
}

function inferGoalType({ goalWeightLbs, startWeight, currentWeightLbs, toleranceLbs = TYPE_TOLERANCE_LBS } = {}) {
  const target = num(goalWeightLbs);
  const ref = referenceWeightLbs({ startWeight, currentWeightLbs });
  if (target == null || ref == null) return null;
  const tol = num(toleranceLbs);
  const allowed = tol == null ? TYPE_TOLERANCE_LBS : tol;
  const delta = target - ref;
  if (Math.abs(delta) <= allowed) return 'maintain';
  return delta > 0 ? 'gain' : 'lose';
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
  const kind = type || inferGoalType({ goalWeightLbs, startWeight, currentWeightLbs });
  if (kind === 'maintain') return 0;
  const start = num(startWeight) != null ? num(startWeight) : num(currentWeightLbs);
  const target = num(goalWeightLbs);
  if (start == null || target == null) return null;
  if (kind === 'lose') return +Math.max(0, start - target).toFixed(2);
  if (kind === 'gain') return +Math.max(0, target - start).toFixed(2);
  return 0;
}

function validateGoalWeight({ goalWeightLbs, startWeight, currentWeightLbs } = {}) {
  const target = num(goalWeightLbs);
  if (target == null) return { ok: false, error: 'Enter a goal weight.' };
  const ref = referenceWeightLbs({ startWeight, currentWeightLbs });
  if (ref == null) {
    return { ok: false, error: 'Add a starting weight or a weigh-in so we can derive the amount to lose or gain.' };
  }
  return { ok: true };
}

module.exports = {
  TYPE_TOLERANCE_LBS,
  computedGoalWeightLbs,
  amountLbsFromGoalWeight,
  inferGoalType,
  referenceWeightLbs,
  validateGoalWeight,
  num
};
