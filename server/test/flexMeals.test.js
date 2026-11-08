const test = require('node:test');
const assert = require('node:assert');
const FE = require('../services/flexEstimator');
const FD = require('../services/flexDays');

function logsFor(days, perSlot) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
    for (const [meal, kcal] of Object.entries(perSlot)) out.push({ date, meal, calories: kcal, foodName: meal });
  }
  return out;
}

test('slot baselines: dinner = big meal; other slots fall back to population shares', () => {
  const b = FE.computeBaseline([]);
  assert.strictEqual(b.slots.dinner, b.bigMeal);
  assert.strictEqual(b.slots.breakfast, Math.round(b.bigMeal * FE.SLOT_SHARE.breakfast));
  assert.strictEqual(b.slots.snack, Math.round(b.bigMeal * FE.SLOT_SHARE.snack));
});

test('slot baselines use that slot\'s own history when there is enough', () => {
  const b = FE.computeBaseline(logsFor(20, { breakfast: 400, lunch: 600, dinner: 1000, snack: 200 }));
  assert.strictEqual(b.history, 'rich');
  assert.strictEqual(b.slots.breakfast, 400);
  assert.strictEqual(b.slots.lunch, 600);
  assert.strictEqual(b.slots.snack, 200);
  assert.strictEqual(FE.forMeal(b, 'dinner').bigMeal, b.bigMeal);
});

test('a slot is never scaled above the big meal', () => {
  const logs = logsFor(20, { dinner: 800 }).concat(logsFor(10, { snack: 1500 }));
  const b = FE.computeBaseline(logs);
  assert.ok(b.slots.snack <= b.bigMeal);
});

test('per-meal estimate scales with the slot baseline', () => {
  const b = FE.computeBaseline(logsFor(20, { breakfast: 400, dinner: 1000 }));
  const foods = [{ key: 'turkey' }, { key: 'stuffing' }];
  const din = FE.estimate({ foods, baseline: FE.forMeal(b, 'dinner') });
  const brk = FE.estimate({ foods, baseline: FE.forMeal(b, 'breakfast') });
  assert.ok(brk.kcal < din.kcal);
  assert.ok(Math.abs(brk.kcal / din.kcal - 0.4) < 0.05);
});

test('forMeal defaults unknown slots to dinner', () => {
  const b = FE.computeBaseline([]);
  assert.strictEqual(FE.forMeal(b, 'brunch').meal, 'dinner');
});

test('sumMeals adds midpoints and ranges; confidence is the weakest', () => {
  const s = FD.sumMeals([
    { estimateKcal: 1000, estimateLow: 800, estimateHigh: 1200, confidence: 'medium' },
    { estimateKcal: 300, estimateLow: 240, estimateHigh: 360, confidence: 'low' }
  ]);
  assert.deepStrictEqual(s, { estimateKcal: 1300, estimateLow: 1040, estimateHigh: 1560, confidence: 'low' });
  assert.strictEqual(FD.sumMeals([]).estimateKcal, 0);
});

test('mealsOf: per-meal docs pass through; old whole-day docs become one legacy entry', () => {
  const meals = [{ _id: 'a', meal: 'lunch', estimateKcal: 500 }];
  assert.strictEqual(FD.mealsOf({ meals, estimateKcal: 500 }), meals);
  const legacy = FD.mealsOf({ estimateKcal: 2400, estimateLow: 1800, estimateHigh: 3000, label: 'Thanksgiving' });
  assert.strictEqual(legacy.length, 1);
  assert.strictEqual(legacy[0].legacy, true);
  assert.strictEqual(legacy[0].meal, 'other');
  assert.strictEqual(legacy[0].estimateKcal, 2400);
  assert.deepStrictEqual(FD.mealsOf({ estimateKcal: 0 }), []);
  assert.deepStrictEqual(FD.mealsOf(null), []);
});
