const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Micros = require('../services/micronutrients');
const { toFood, nutrientAmount, FDC_NUTRIENTS } = require('../../scripts/import-fdc');

const bananaRaw = require('../../data/fdc/fixtures/173944.json');
const spinachRaw = require('../../data/fdc/fixtures/168462.json');
const milkRaw = require('../../data/fdc/fixtures/173441.json');

const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const foodModel = fs.readFileSync(path.join(__dirname, '../models/Food.js'), 'utf8');
const logModel = fs.readFileSync(path.join(__dirname, '../models/FoodLog.js'), 'utf8');

test('FDA Daily Values used by the UI match the official FDA table (retrieved 2026-11-15)', () => {
  const byKey = Object.fromEntries(Micros.MICRO_FIELDS.map((f) => [f.key, f]));
  assert.equal(byKey.fiber.dv, 28);
  assert.equal(byKey.sodium.dv, 2300);
  assert.equal(byKey.potassium.dv, 4700);
  assert.equal(byKey.calcium.dv, 1300);
  assert.equal(byKey.iron.dv, 18);
  assert.equal(byKey.magnesium.dv, 420);
  assert.equal(byKey.vitaminA.dv, 900);
  assert.equal(byKey.vitaminC.dv, 90);
  assert.equal(byKey.vitaminD.dv, 20);
  assert.equal(byKey.vitaminB12.dv, 2.4);
  assert.equal(byKey.sugar.dv, null);
});

test('importing an official FDC fixture scales per-100g amounts to an official portion and does not invent nutrients', () => {
  const banana = toFood(bananaRaw, { portionQuery: 'medium (7' });
  assert.equal(banana.sourceFdcId, 173944);
  assert.equal(banana.gramsPerServing, 118);
  assert.equal(banana.servingUnit, 'medium (7" to 7-7/8" long)');
  const kPer100 = nutrientAmount(bananaRaw, 1092);
  assert.equal(kPer100, 358);
  assert.equal(banana.potassium, +(358 * 1.18).toFixed(3));
  assert.equal(banana.calories, Math.round(89 * 1.18));
  assert.equal(banana.vitaminB12, 0); // official measured zero, not missing

  const incomplete = { fdcId: 1, description: 'Test food', dataType: 'SR Legacy', foodNutrients: [
    { nutrient: { id: 1008, name: 'Energy', unitName: 'kcal' }, amount: 50 }
  ] };
  const food = toFood(incomplete, { servingGrams: 100 });
  assert.equal(food.calories, 50);
  assert.equal(food.potassium, undefined);
  assert.equal(food.iron, undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(food, 'calcium'));
});

test('day totals skip unknown micros and do not treat missing as zero', () => {
  const banana = toFood(bananaRaw, { portionQuery: 'medium (7' });
  const logs = [
    { ...Micros.scaleMicros(banana, 1) },
    { calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0 } // no micros
  ];
  const { totals, coverage, items } = Micros.totalMicros(logs);
  assert.equal(items, 2);
  assert.equal(coverage.potassium, 1);
  assert.equal(totals.potassium, banana.potassium);
  const view = Micros.viewModel(logs);
  const k = view.nutrients.find((n) => n.key === 'potassium');
  assert.equal(k.unknown, false);
  assert.ok(k.percentDv > 0);
  const empty = Micros.viewModel([{ calories: 10 }]);
  assert.ok(empty.nutrients.every((n) => n.unknown || n.key === 'fiber'));
  const pot = empty.nutrients.find((n) => n.key === 'potassium');
  assert.equal(pot.unknown, true);
  assert.equal(pot.amount, null);
});

test('Food and FoodLog schemas add optional micronutrient fields; the Food page can render a DV view', () => {
  for (const key of ['potassium', 'calcium', 'iron', 'magnesium', 'vitaminA', 'vitaminC', 'vitaminD', 'vitaminB12']) {
    assert.match(foodModel, new RegExp(key + ':'));
    assert.match(logModel, new RegExp(key + ':'));
  }
  assert.match(foodModel, /null\/undefined = unknown/);
  assert.match(html, /id="micro-progress"/);
  assert.match(app, /function renderMicroProgress/);
  assert.match(app, /renderMicroProgress\(/);
  assert.match(app, /data\.totals\.micros/);
});

test('FDC nutrient map covers the tracked micros and the three fixtures are official SR Legacy records', () => {
  const needed = ['fiber', 'sugar', 'sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'vitaminA', 'vitaminC', 'vitaminD', 'vitaminB12'];
  const keys = Object.values(FDC_NUTRIENTS).map((n) => n.key);
  for (const k of needed) assert.ok(keys.includes(k), k);
  assert.equal(bananaRaw.dataType, 'SR Legacy');
  assert.equal(spinachRaw.fdcId, 168462);
  assert.equal(milkRaw.fdcId, 173441);
});
