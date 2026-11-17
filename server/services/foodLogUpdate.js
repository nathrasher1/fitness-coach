/**
 * Pure update rules for a logged food entry (PATCH /api/food-logs/:id).
 * Nutrition is always rescaled from the values stored on the log (the snapshot
 * at log time), never from a later edit of the food catalog.
 * The linked food is used only to convert amount + unit into servings.
 */
const { isDateKey } = require('./dates');
const Micros = require('./micronutrients');
const { amountToServings, amountToGrams } = require('./portions');
const Servings = require('../../client/lib/servings');

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

function fail(status, error) {
  return { ok: false, status, error };
}

function hasOwn(body, key) {
  return body != null && Object.prototype.hasOwnProperty.call(body, key) && body[key] != null && body[key] !== '';
}

function perServing(log) {
  const s = Number(log && log.servings);
  if (!(s > 0)) return null;
  return {
    calories: Number(log.calories) / s,
    protein: Number(log.protein || 0) / s,
    carbs: Number(log.carbs || 0) / s,
    fat: Number(log.fat || 0) / s,
    fiber: Number(log.fiber || 0) / s,
    ...Micros.scaleMicros(log, 1 / s)
  };
}

function scaleNutrition(per, qty) {
  const out = {
    servings: qty,
    calories: Math.round(per.calories * qty),
    protein: +(per.protein * qty).toFixed(1),
    carbs: +(per.carbs * qty).toFixed(1),
    fat: +(per.fat * qty).toFixed(1),
    fiber: +(per.fiber * qty).toFixed(1)
  };
  const scaled = Micros.scaleMicros(per, qty);
  for (const key of Micros.MICRO_KEYS) {
    if (Object.prototype.hasOwnProperty.call(scaled, key)) out[key] = scaled[key];
  }
  return out;
}

function fallbackAmountLabel(amount, unit) {
  const u = String(unit || 'serving');
  const name = u.replace(/^p:/, '');
  const n = Number(amount);
  if (u === 'serving') return `${Servings.fmt(n)} serving${n === 1 ? '' : 's'}`;
  return `${Servings.fmt(n)} ${name}`;
}

function amountLabelFor(amount, unit, food) {
  if (food) {
    try {
      return Servings.amountLabel(Number(amount), unit || 'serving', food).slice(0, 60);
    } catch (_) {
      // fall through
    }
  }
  return fallbackAmountLabel(amount, unit).slice(0, 60);
}

function derivedAmount(log, qty) {
  const prevAmt = Number(log.amount);
  const prevQty = Number(log.servings);
  if (!(prevAmt > 0) || !(prevQty > 0)) return null;
  return {
    amount: +(prevAmt * (qty / prevQty)).toFixed(4),
    amountUnit: log.amountUnit || 'serving'
  };
}

/**
 * Resolve a new serving quantity from the request body.
 * Prefer amount + amountUnit (same as POST). Otherwise servings.
 * When neither is sent, quantity is unchanged.
 */
function resolveQuantity(log, food, body) {
  const hasAmount = hasOwn(body, 'amount');
  const hasServings = hasOwn(body, 'servings');

  if (hasAmount) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return fail(400, 'Amount must be greater than 0');
    const unit = body.amountUnit != null && body.amountUnit !== ''
      ? String(body.amountUnit)
      : (log.amountUnit || 'serving');
    let qty = null;
    if (food) {
      qty = amountToServings(amount, unit, food);
      if (qty == null) return fail(400, 'That unit does not match this food');
    } else if (unit === 'serving') {
      qty = amount;
    } else if (Number(log.amount) > 0 && String(log.amountUnit || 'serving') === unit) {
      qty = (Number(log.servings) * amount) / Number(log.amount);
    } else {
      return fail(400, 'This entry has no food to convert units from. Edit the number of servings instead.');
    }
    if (!qty || qty <= 0) return fail(400, 'Amount must be greater than 0');

    const per = perServing(log);
    if (per && food) {
      const grams = amountToGrams(amount, unit, food);
      const entryCalories = Math.round(per.calories * qty);
      const kcalPerGram = grams > 0 ? entryCalories / grams : 0;
      if (kcalPerGram > 10) {
        return fail(400, `That would be ${Math.round(kcalPerGram)} kcal per gram, which is not possible. Try again or log it manually.`);
      }
    }
    return { ok: true, changed: true, qty, amount, amountUnit: unit };
  }

  if (hasServings) {
    const qty = Number(body.servings);
    if (!Number.isFinite(qty) || qty <= 0) return fail(400, 'servings must be > 0');
    const derived = derivedAmount(log, qty);
    return {
      ok: true,
      changed: qty !== Number(log.servings),
      qty,
      amount: derived ? derived.amount : undefined,
      amountUnit: derived ? derived.amountUnit : undefined
    };
  }

  return { ok: true, changed: false, qty: Number(log.servings) };
}

function applyManualMacros(log, body, fields) {
  if (!log.isManual) return;
  const nums = [
    ['calories', (n) => Math.round(n)],
    ['protein', (n) => +n.toFixed(1)],
    ['carbs', (n) => +n.toFixed(1)],
    ['fat', (n) => +n.toFixed(1)],
    ['fiber', (n) => +n.toFixed(1)]
  ];
  for (const [key, fmt] of nums) {
    if (!hasOwn(body, key)) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0) {
      return fail(400, `${key} must be 0 or greater`);
    }
    fields[key] = fmt(n);
  }
  if (hasOwn(body, 'foodName')) {
    const name = String(body.foodName).trim();
    if (!name) return fail(400, 'Label is required');
    fields.foodName = name.slice(0, 80);
  }
  return { ok: true };
}

/**
 * Build the field patch for one log. `log` and optional `food` are plain objects.
 * Returns { ok: true, fields } or { ok: false, status, error }.
 */
function apply(log, food, body) {
  if (!log) return fail(404, 'Not found');
  const fields = {};
  const bodyObj = body || {};

  if (hasOwn(bodyObj, 'meal')) {
    if (!MEALS.includes(bodyObj.meal)) return fail(400, 'Invalid meal');
    fields.meal = bodyObj.meal;
  }
  if (hasOwn(bodyObj, 'date')) {
    if (!isDateKey(String(bodyObj.date))) return fail(400, 'Invalid date');
    fields.date = String(bodyObj.date);
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'note') && bodyObj.note != null) {
    fields.note = String(bodyObj.note);
  }

  const qtyRes = resolveQuantity(log, food, bodyObj);
  if (!qtyRes.ok) return qtyRes;

  const sendingManualMacros = log.isManual && ['calories', 'protein', 'carbs', 'fat', 'fiber', 'foodName']
    .some((k) => hasOwn(bodyObj, k));

  if (qtyRes.changed) {
    const per = perServing(log);
    if (!per) return fail(400, 'servings must be > 0');
    Object.assign(fields, scaleNutrition(per, qtyRes.qty));
    if (qtyRes.amount != null) {
      fields.amount = qtyRes.amount;
      fields.amountUnit = qtyRes.amountUnit || '';
      fields.amountLabel = amountLabelFor(qtyRes.amount, qtyRes.amountUnit, food);
    }
  }

  // Explicit manual macros win over a simultaneous scale (the numbers the user typed).
  if (sendingManualMacros) {
    const man = applyManualMacros(log, bodyObj, fields);
    if (man && !man.ok) return man;
  }

  return { ok: true, fields };
}

function compactFoodInfo(food) {
  if (!food) return null;
  return {
    _id: String(food._id),
    name: food.name,
    brand: food.brand || '',
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    density: food.density,
    portions: food.portions,
    barcode: food.barcode || ''
  };
}

module.exports = {
  MEALS,
  apply,
  perServing,
  scaleNutrition,
  resolveQuantity,
  compactFoodInfo,
  amountLabelFor
};
