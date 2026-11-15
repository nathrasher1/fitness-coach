const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');

function between(src, start, end) {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i);
  assert.ok(i >= 0, 'missing start: ' + start);
  assert.ok(j > i, 'missing end after ' + start);
  return src.slice(i, j);
}

test('nav lists Nutrition immediately after Food, using those simple names', () => {
  const nav = between(html, 'id="main-nav"', '</nav>');
  const food = nav.indexOf('data-panel="food"');
  const nutrition = nav.indexOf('data-panel="nutrition"');
  const recipes = nav.indexOf('data-panel="recipes"');
  assert.ok(food >= 0 && nutrition > food && recipes > nutrition);
  assert.match(nav, />Food</);
  assert.match(nav, />Nutrition</);
  assert.doesNotMatch(nav, /Nutrient Dashboard|Food Log/);
});

test('Food page keeps logging tools and a compact calories/macros summary only', () => {
  const food = between(html, '<section id="food"', '<section id="nutrition"');
  assert.match(food, /id="food-date"/);
  assert.match(food, /id="food-prev"/);
  assert.match(food, /id="food-next"/);
  assert.match(food, /id="btn-copy-yesterday"/);
  assert.match(food, /id="food-log-list"/);
  assert.match(food, /id="flex-sheet"/);
  assert.match(food, /id="energy-remaining"/);
  assert.match(food, /id="food-day-totals"/);
  assert.match(food, /energy-card-compact/);
  assert.match(food, /id="food-to-nutrition"/);
  assert.match(food, />Nutrition</);
  assert.doesNotMatch(food, /id="macro-progress"/);
  assert.doesNotMatch(food, /id="micro-progress"/);
  assert.doesNotMatch(food, /id="micro-bars"/);
  assert.doesNotMatch(food, /id="fat-bars"/);
  assert.doesNotMatch(food, />Micronutrients</);
  assert.doesNotMatch(food, /Fats &amp; omega-3/);
  assert.match(app, /data-add-meal=/);
  assert.match(app, /data-copy-yesterday=/);
  assert.match(app, /data-flex-add=/);
  assert.match(app, /method: 'DELETE'/);
});

test('Nutrition page shows day totals vs targets, v1 micros, and fat/omega-3, with a link back to Food', () => {
  const nutrition = between(html, '<section id="nutrition"', '<section id="recipes"');
  assert.match(nutrition, /id="nutrition-date"/);
  assert.match(nutrition, /id="nutrition-prev"/);
  assert.match(nutrition, /id="nutrition-next"/);
  assert.match(nutrition, /id="nutrition-to-food"/);
  assert.match(nutrition, />Food</);
  assert.match(nutrition, /id="nutrition-energy-remaining"/);
  assert.match(nutrition, /id="nutrition-day-totals"/);
  assert.match(nutrition, /id="nutrition-macro-progress"/);
  assert.match(nutrition, />Micronutrients</);
  assert.match(nutrition, /id="micro-progress"/);
  assert.match(nutrition, /id="micro-bars"/);
  assert.match(nutrition, /Fats &amp; omega-3/);
  assert.match(nutrition, /id="fat-bars"/);
  assert.doesNotMatch(nutrition, /id="food-log-list"/);
  assert.doesNotMatch(nutrition, /id="btn-copy-yesterday"/);
  assert.doesNotMatch(nutrition, /id="flex-sheet"/);
});

test('Food and Nutrition share one selected date and navigate to each other', () => {
  assert.match(app, /function logDate/);
  assert.match(app, /function setLogDate/);
  assert.match(app, /function shiftLogDate/);
  assert.match(app, /function loadNutrition/);
  assert.match(app, /function openPanel/);
  assert.match(app, /\['food-date', 'nutrition-date'\]/);
  assert.match(app, /openPanel\('nutrition'\)/);
  assert.match(app, /openPanel\('food'\)/);
  assert.match(app, /dataset\.panel === 'nutrition'/);
  assert.match(app, /V1_MICRO_KEYS/);
  assert.match(app, /FAT_MICRO_KEYS/);
  assert.doesNotMatch(app, /function shiftFoodDate/);
});
