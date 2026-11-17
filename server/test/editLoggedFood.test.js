const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const FoodLogUpdate = require('../services/foodLogUpdate');

const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../client/styles.css'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../routes/foodLogs.js'), 'utf8');

const yogurt = {
  _id: 'food-yogurt',
  name: 'Nonfat Greek yogurt',
  servingSize: 170,
  servingUnit: 'g',
  calories: 100,
  protein: 17,
  carbs: 6,
  fat: 0,
  fiber: 0
};

const yogurtLog = {
  _id: 'log-1',
  user: 'user-1',
  date: '2026-11-16',
  meal: 'breakfast',
  food: 'food-yogurt',
  foodName: 'Nonfat Greek yogurt',
  servings: 1,
  amount: 170,
  amountUnit: 'g',
  amountLabel: '170 g',
  calories: 100,
  protein: 17,
  carbs: 6,
  fat: 0,
  fiber: 0,
  calcium: 200,
  vitaminD: 2,
  isManual: false
};

test('Food page and Diary let a logged entry be opened for edit, and keep delete', () => {
  assert.match(html, /id="food-edit-sheet"/);
  assert.match(html, /id="food-edit-amount"/);
  assert.match(html, /id="food-edit-unit"/);
  assert.match(html, /id="food-edit-date"/);
  assert.match(html, /id="btn-save-food-edit"/);
  assert.match(html, /type="text" id="food-edit-amount"/);
  assert.match(html, /inputmode="decimal"/);
  assert.match(html, /data-select-all="1"/);
  assert.match(app, /data-edit-log=/);
  assert.match(app, /function openFoodEditSheet/);
  assert.match(app, /function saveFoodEdit/);
  assert.match(app, /method: 'PATCH'/);
  assert.match(app, /api\(`\/food-logs\/\$\{log\._id\}`/);
  assert.match(app, /class="day-food-edit" data-edit-log=/);
  assert.match(app, /class="btn btn-danger btn-sm" data-id=/);
  assert.match(app, /method: 'DELETE'/);
  assert.match(app, /selectAllTextInput/);
  assert.match(app, /setSelectionRange\(0, len\)/);
  assert.match(css, /\.diary-item-main/);
  assert.match(css, /\.day-food-edit/);
});

test('PATCH /api/food-logs/:id stays authenticated and scoped to the owner', () => {
  assert.match(routes, /router\.use\(requireAuth\)/);
  assert.match(routes, /router\.patch\('\/:id'/);
  assert.match(routes, /FoodLog\.findOne\(\{ _id: req\.params\.id, user: req\.session\.userId \}\)/);
  assert.match(routes, /FoodLogUpdate\.apply/);
  assert.match(routes, /status\(404\)\.json\(\{ error: 'Not found' \}\)/);
});

test('changing servings scales macros and known micros, and leaves unknown micros unset', () => {
  const result = FoodLogUpdate.apply(yogurtLog, yogurt, { servings: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.fields.servings, 2);
  assert.equal(result.fields.calories, 200);
  assert.equal(result.fields.protein, 34);
  assert.equal(result.fields.carbs, 12);
  assert.equal(result.fields.fat, 0);
  assert.equal(result.fields.calcium, 400);
  assert.equal(result.fields.vitaminD, 4);
  assert.equal(result.fields.amount, 340);
  assert.equal(result.fields.amountUnit, 'g');
  assert.ok(!Object.prototype.hasOwnProperty.call(result.fields, 'iron'));
  assert.ok(!Object.prototype.hasOwnProperty.call(result.fields, 'omega3'));
});

test('amount and unit convert through the food serving, then scale the stored snapshot', () => {
  const result = FoodLogUpdate.apply(yogurtLog, yogurt, { amount: 85, amountUnit: 'g' });
  assert.equal(result.ok, true);
  assert.equal(result.fields.servings, 0.5);
  assert.equal(result.fields.calories, 50);
  assert.equal(result.fields.protein, 8.5);
  assert.equal(result.fields.calcium, 100);
  assert.equal(result.fields.amount, 85);
  assert.equal(result.fields.amountUnit, 'g');
  assert.match(result.fields.amountLabel, /85 g/);
});

test('meal and date can change without touching nutrition', () => {
  const result = FoodLogUpdate.apply(yogurtLog, yogurt, { meal: 'lunch', date: '2026-11-15' });
  assert.equal(result.ok, true);
  assert.equal(result.fields.meal, 'lunch');
  assert.equal(result.fields.date, '2026-11-15');
  assert.equal(result.fields.calories, undefined);
  assert.equal(result.fields.servings, undefined);
  assert.equal(result.fields.protein, undefined);
});

test('rejects invalid amount, meal, date, and impossible kcal-per-gram', () => {
  assert.equal(FoodLogUpdate.apply(yogurtLog, yogurt, { amount: 0 }).status, 400);
  assert.equal(FoodLogUpdate.apply(yogurtLog, yogurt, { servings: -1 }).status, 400);
  assert.equal(FoodLogUpdate.apply(yogurtLog, yogurt, { meal: 'brunch' }).status, 400);
  assert.equal(FoodLogUpdate.apply(yogurtLog, yogurt, { date: '11/16/2026' }).status, 400);
  assert.equal(FoodLogUpdate.apply(yogurtLog, yogurt, { date: 'not-a-date' }).status, 400);
  assert.equal(FoodLogUpdate.apply(yogurtLog, yogurt, { amount: 1, amountUnit: 'cupcakes' }).status, 400);

  const dense = {
    ...yogurtLog,
    // 900 kcal in a 10 g serving would be 90 kcal/g once expressed per gram
    calories: 900,
    servings: 1,
    amount: 10,
    amountUnit: 'g'
  };
  const denseFood = { ...yogurt, servingSize: 10, servingUnit: 'g', calories: 900 };
  const boom = FoodLogUpdate.apply(dense, denseFood, { amount: 10, amountUnit: 'g' });
  // 900 kcal / 10 g = 90 kcal/g, over the 10 kcal/g guard (same as POST)
  assert.equal(boom.ok, false);
  assert.equal(boom.status, 400);
  assert.match(boom.error, /kcal per gram/);
});

test('without a linked food, the same unit can still be scaled; a new unit is rejected', () => {
  const ok = FoodLogUpdate.apply(yogurtLog, null, { amount: 340, amountUnit: 'g' });
  assert.equal(ok.ok, true);
  assert.equal(ok.fields.servings, 2);
  assert.equal(ok.fields.calories, 200);
  assert.equal(ok.fields.amount, 340);

  const bad = FoodLogUpdate.apply(yogurtLog, null, { amount: 2, amountUnit: 'oz' });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 400);
});

test('manual entries can update label, macros, meal, and date', () => {
  const manual = {
    _id: 'log-m',
    date: '2026-11-16',
    meal: 'dinner',
    foodName: 'Restaurant pasta',
    servings: 1,
    calories: 850,
    protein: 25,
    carbs: 90,
    fat: 30,
    fiber: 0,
    isManual: true
  };
  const result = FoodLogUpdate.apply(manual, null, {
    foodName: 'Pasta night',
    calories: 700,
    protein: 22,
    carbs: 80,
    fat: 24,
    meal: 'lunch',
    date: '2026-11-14'
  });
  assert.equal(result.ok, true);
  assert.equal(result.fields.foodName, 'Pasta night');
  assert.equal(result.fields.calories, 700);
  assert.equal(result.fields.protein, 22);
  assert.equal(result.fields.meal, 'lunch');
  assert.equal(result.fields.date, '2026-11-14');
  assert.equal(result.fields.servings, undefined);
});

test('GET food logs attach foodInfo so the edit sheet can offer unit choices', () => {
  assert.match(routes, /o\.foodInfo = FoodLogUpdate\.compactFoodInfo\(f\)/);
  const info = FoodLogUpdate.compactFoodInfo(yogurt);
  assert.equal(info.name, 'Nonfat Greek yogurt');
  assert.equal(info.servingSize, 170);
  assert.equal(info.servingUnit, 'g');
  assert.ok(!Object.prototype.hasOwnProperty.call(info, 'user'));
});
