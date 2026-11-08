// Scale-free flex/holiday-day estimator. Pure functions only (no DB), so it is unit-testable
// and shared reasoning stays in one place.
//
// Model:
//   total = baselineBigMeal × FULLNESS[fullness] × PLATES[plates] × correction
//         + dessertServings × DESSERT_KCAL
//   total is spread across the chosen foods by typical holiday plate share; each food's
//   share is anchored to the user's usual grams of that food/category when known, then
//   nudged little (×0.6) / normal (×1) / a lot (×1.5) and renormalised to the total.
//   Range = midpoint ± spread, spread 20% with rich history, 25% medium, 35% thin.
//
// Constants (documented, deliberately round numbers):
const FULLNESS = { light: 0.8, comfortable: 1.0, full: 1.3, stuffed: 1.6 };
const PLATES = { 1: 1.0, 2: 1.6, 3: 2.1 }; // second plate is usually smaller; "3+" = 3
const NUDGE = { little: 0.6, normal: 1.0, lot: 1.5 };
const DESSERT_KCAL = 350; // one slice of pie / a few cookies
const CORRECTION_MIN = 0.7, CORRECTION_MAX = 1.4;
// Population defaults when history is thin (adult holiday dinner / typical day).
const POP = { bigMeal: 1100, daily: 2200, minor: { bigMeal: 950, daily: 2000 } };
// Percentile of per-meal totals used as "your big meal" (between 75th and 90th).
const BIG_MEAL_PCT = 0.85;

// key, label, category, kcal per gram, typical plate share (relative weight), typical grams
const HOLIDAY_MENU = [
  ['turkey', 'Turkey', 'protein', 1.9, 22, 170],
  ['ham', 'Ham', 'protein', 1.6, 18, 140],
  ['prime_rib', 'Prime rib / roast beef', 'protein', 3.0, 20, 170],
  ['stuffing', 'Stuffing', 'starch', 1.8, 14, 140],
  ['mashed_potatoes', 'Mashed potatoes', 'starch', 1.1, 14, 200],
  ['gravy', 'Gravy', 'sauce', 0.8, 5, 80],
  ['rolls', 'Rolls with butter', 'bread', 3.3, 8, 60],
  ['mac_cheese', 'Mac and cheese', 'starch', 1.9, 12, 160],
  ['green_bean_casserole', 'Green bean casserole', 'vegetable', 1.1, 8, 130],
  ['sweet_potato_casserole', 'Sweet potato casserole', 'starch', 1.7, 10, 150],
  ['cranberry_sauce', 'Cranberry sauce', 'sauce', 1.5, 4, 60],
  ['corn', 'Corn', 'vegetable', 0.9, 5, 120],
  ['salad', 'Salad', 'vegetable', 0.6, 4, 100],
  ['deviled_eggs', 'Deviled eggs', 'appetizer', 2.0, 5, 60],
  ['cheese_board', 'Cheese & crackers', 'appetizer', 4.0, 7, 60],
  ['pie', 'Pie', 'dessert', 2.8, 0, 125],
  ['cookies', 'Cookies', 'dessert', 4.6, 0, 60],
  ['wine', 'Wine (glass)', 'drink', 0.83, 0, 150],
  ['beer', 'Beer (bottle)', 'drink', 0.43, 0, 355],
  ['eggnog', 'Eggnog', 'drink', 1.4, 0, 120],
  ['soda', 'Soda', 'drink', 0.4, 0, 355]
].map(([key, label, category, kcalPerG, share, grams]) => ({ key, label, category, kcalPerG, share, grams }));
const MENU_BY_KEY = Object.fromEntries(HOLIDAY_MENU.map((f) => [f.key, f]));
// Drinks/desserts aren't on the plate: estimated per item from typical grams, not plate share.
const OFF_PLATE = new Set(['dessert', 'drink']);
const CATEGORY_DEFAULTS = { protein: [1.9, 20], starch: [1.5, 12], vegetable: [0.9, 6], sauce: [1.0, 4], bread: [3.0, 8], appetizer: [2.5, 5], dessert: [3.0, 0], drink: [0.6, 0], other: [2.0, 8] };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function percentile(values, p) {
  const a = (values || []).filter((v) => Number.isFinite(v) && v > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}

/**
 * Personal baseline from food logs: [{ date, meal, calories, foodName, amount, amountUnit }].
 * Meals are grouped by date+meal; big meal = 85th percentile meal total; daily = median day.
 * Portions: median grams per lowercase food name (gram-logged rows only).
 */
function computeBaseline(logs, { minor = false, excludeDates } = {}) {
  const skip = excludeDates instanceof Set ? excludeDates : new Set(excludeDates || []);
  const meals = {}, days = {}, grams = {};
  for (const l of logs || []) {
    if (!l || skip.has(l.date) || !(l.calories > 0)) continue;
    const mk = l.date + '|' + (l.meal || 'other');
    meals[mk] = (meals[mk] || 0) + l.calories;
    days[l.date] = (days[l.date] || 0) + l.calories;
    if (l.amount > 0 && /^(g|gram|grams)$/i.test(l.amountUnit || '')) {
      const k = String(l.foodName || '').toLowerCase().trim();
      if (k) (grams[k] = grams[k] || []).push(l.amount);
    }
  }
  const mealTotals = Object.values(meals);
  const dayCount = Object.keys(days).length;
  const pop = minor ? POP.minor : POP;
  const history = dayCount >= 14 && mealTotals.length >= 20 ? 'rich' : dayCount >= 5 ? 'medium' : 'thin';
  const pBig = percentile(mealTotals, BIG_MEAL_PCT);
  const pDay = percentile(Object.values(days), 0.5);
  // Blend toward population defaults when history is short.
  const w = history === 'rich' ? 1 : history === 'medium' ? 0.6 : 0;
  const bigMeal = Math.round(pBig ? w * pBig + (1 - w) * pop.bigMeal : pop.bigMeal);
  const daily = Math.round(pDay ? w * pDay + (1 - w) * pop.daily : pop.daily);
  const portions = {};
  for (const [k, arr] of Object.entries(grams)) if (arr.length >= 2) portions[k] = Math.round(percentile(arr, 0.5));
  return { bigMeal, daily, history, dayCount, mealCount: mealTotals.length, portions, source: w === 0 ? 'population' : w === 1 ? 'personal' : 'blended' };
}

/** Resolve one selected food (menu key, or custom/database food with optional kcalPerG). */
function resolveFood(sel) {
  const m = sel && sel.key && MENU_BY_KEY[sel.key];
  if (m) return { ...m, nudge: NUDGE[sel.nudge] ? sel.nudge : 'normal' };
  const category = CATEGORY_DEFAULTS[sel && sel.category] ? sel.category : 'other';
  const [dDens, dShare] = CATEGORY_DEFAULTS[category];
  const kcalPerG = Number(sel && sel.kcalPerG) > 0 ? Math.min(9, Number(sel.kcalPerG)) : dDens;
  return {
    key: 'custom:' + String((sel && (sel.foodId || sel.label)) || 'food').slice(0, 60),
    label: String((sel && sel.label) || 'Food').slice(0, 80),
    category, kcalPerG, share: dShare, grams: Number(sel && sel.grams) > 0 ? Number(sel.grams) : 120,
    nudge: NUDGE[sel && sel.nudge] ? sel.nudge : 'normal'
  };
}

function spreadFor(history) { return history === 'rich' ? 0.2 : history === 'medium' ? 0.25 : 0.35; }

/**
 * Estimate a flex day's meal. Returns midpoint, range, and per-food breakdown.
 * input: { foods:[{key|label,category,kcalPerG,nudge}], fullness, plates, dessertServings, baseline, correction }
 */
function estimate(input) {
  const baseline = input.baseline || computeBaseline([]);
  const fullness = FULLNESS[input.fullness] ? input.fullness : 'comfortable';
  const plates = clamp(parseInt(input.plates, 10) || 1, 1, 3);
  const dessertServings = clamp(Number(input.dessertServings) || 0, 0, 6);
  const correction = clamp(Number(input.correction) || 1, CORRECTION_MIN, CORRECTION_MAX);
  const foods = (input.foods || []).slice(0, 30).map(resolveFood);
  const plateFoods = foods.filter((f) => !OFF_PLATE.has(f.category));
  const offFoods = foods.filter((f) => OFF_PLATE.has(f.category) && f.category !== 'dessert');
  const dessertFoods = foods.filter((f) => f.category === 'dessert');

  const plateTotal = baseline.bigMeal * FULLNESS[fullness] * PLATES[plates] * correction;

  // Plate shares: typical share, anchored by the user's usual grams × density when known.
  const weights = plateFoods.map((f) => {
    const usual = baseline.portions && baseline.portions[f.label.toLowerCase()];
    const base = usual ? (usual * f.kcalPerG) / 10 : f.share; // usual grams → kcal-ish weight
    return Math.max(0.1, base) * NUDGE[f.nudge];
  });
  const wSum = weights.reduce((a, v) => a + v, 0) || 1;
  const items = plateFoods.map((f, i) => {
    const kcal = plateFoods.length ? (plateTotal * weights[i]) / wSum : 0;
    return { key: f.key, label: f.label, category: f.category, nudge: f.nudge, kcal: Math.round(kcal), grams: Math.round(kcal / f.kcalPerG) };
  });
  // Drinks: one typical serving each × nudge (drinks don't scale with fullness).
  for (const f of offFoods) {
    const kcal = f.grams * f.kcalPerG * NUDGE[f.nudge] * correction;
    items.push({ key: f.key, label: f.label, category: f.category, nudge: f.nudge, kcal: Math.round(kcal), grams: Math.round(f.grams * NUDGE[f.nudge]) });
  }
  // Desserts: dessertServings split across chosen desserts (or a generic dessert).
  const dessertKcal = dessertServings * DESSERT_KCAL * correction;
  if (dessertKcal > 0) {
    const ds = dessertFoods.length ? dessertFoods : [{ key: 'dessert', label: 'Dessert', category: 'dessert', kcalPerG: 3, nudge: 'normal' }];
    const dw = ds.map((f) => NUDGE[f.nudge]); const dsum = dw.reduce((a, v) => a + v, 0);
    ds.forEach((f, i) => { const kcal = (dessertKcal * dw[i]) / dsum; items.push({ key: f.key, label: f.label, category: 'dessert', nudge: f.nudge, kcal: Math.round(kcal), grams: Math.round(kcal / f.kcalPerG) }); });
  }
  const mid = plateFoods.length || items.length ? items.reduce((a, it) => a + it.kcal, 0) : Math.round(plateTotal);
  const spread = spreadFor(baseline.history);
  const confidence = baseline.history === 'rich' ? 'medium' : 'low'; // a scale-free estimate is never "high"
  return {
    kcal: Math.round(mid),
    low: Math.round(mid * (1 - spread)),
    high: Math.round(mid * (1 + spread)),
    spread,
    confidence,
    label: `Estimate ≈${Math.round(mid)} kcal (${Math.round(mid * (1 - spread))}–${Math.round(mid * (1 + spread))})`,
    fullness, plates, dessertServings, correction,
    baselineBigMeal: baseline.bigMeal, baselineSource: baseline.source, history: baseline.history,
    items
  };
}

/**
 * Basic calibration. Given the flex day's estimated surplus vs. usual daily intake and the
 * observed trend change (lbs) across the 3–7 days after it vs. the prior trend, derive a
 * correction factor (bounded 0.7–1.4), smoothed with the previous factor.
 * predictedSurplus: kcal above usual; observedDeltaLbs: actual minus expected change.
 */
function calibrate({ predictedSurplus, observedDeltaLbs, previous = 1, weighIns = 0 }) {
  const prev = clamp(Number(previous) || 1, CORRECTION_MIN, CORRECTION_MAX);
  if (!(weighIns >= 3) || !(predictedSurplus > 200) || !Number.isFinite(observedDeltaLbs)) return { factor: prev, applied: false };
  // Much of a one-day jump is water/food mass; only ~half of the scale change is treated as signal.
  const observedSurplus = observedDeltaLbs * 3500 * 0.5;
  const ratio = clamp(observedSurplus / predictedSurplus, CORRECTION_MIN, CORRECTION_MAX);
  const factor = Math.round(clamp(prev * 0.5 + ratio * 0.5, CORRECTION_MIN, CORRECTION_MAX) * 100) / 100;
  return { factor, applied: true, ratio: Math.round(ratio * 100) / 100 };
}

/**
 * Trend change around a flex day from weigh-ins: [{date, weight}]. Uses the mean of the
 * 3–7 days after minus the mean of up to 7 days before, minus the pre-existing trend slope
 * carried forward (so an ongoing cut doesn't look like under-eating). Returns null when there
 * are fewer than 3 weigh-ins after or none before.
 */
function trendDelta(weights, flexDate) {
  const shift = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const before = weights.filter((w) => w.date < flexDate && w.date >= shift(flexDate, -7));
  const after = weights.filter((w) => w.date > flexDate && w.date >= shift(flexDate, 3) && w.date <= shift(flexDate, 7));
  if (!before.length || after.length < 3) return null;
  const mean = (a) => a.reduce((s, w) => s + w.weight, 0) / a.length;
  const dayNum = (k) => Date.parse(k + 'T00:00:00Z') / 86400000;
  let slope = 0;
  if (before.length >= 2) { const a = before[0], b = before[before.length - 1]; slope = (b.weight - a.weight) / Math.max(1, dayNum(b.date) - dayNum(a.date)); }
  const gapDays = mean(after.map((w) => ({ weight: dayNum(w.date) }))) - mean(before.map((w) => ({ weight: dayNum(w.date) })));
  return { deltaLbs: Math.round((mean(after) - mean(before) - slope * gapDays) * 100) / 100, weighIns: after.length };
}

module.exports = { trendDelta, FULLNESS, PLATES, NUDGE, DESSERT_KCAL, POP, BIG_MEAL_PCT, CORRECTION_MIN, CORRECTION_MAX, HOLIDAY_MENU, percentile, computeBaseline, resolveFood, estimate, calibrate, spreadFor };
