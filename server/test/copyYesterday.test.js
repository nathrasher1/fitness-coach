const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const CY = require('../services/copyYesterday');

const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '../routes/foodLogs.js'), 'utf8');

const yesterday = [
  { meal: 'breakfast', food: 'f1', foodName: 'Oats', servings: 1, calories: 150, amount: 1, amountUnit: 'serving', amountLabel: '1 serving', protein: 5, carbs: 27, fat: 3, fiber: 4, note: '', isManual: false },
  { meal: 'lunch', food: 'f2', foodName: 'Chicken', servings: 1, calories: 400, protein: 40, carbs: 0, fat: 10, fiber: 0, note: '', isManual: false }
];

test('empty yesterday meal or day is a graceful no-op, not an error payload that must 404', () => {
  const emptyMeal = CY.copyResult({ sourceLogs: yesterday, existingTargetLogs: [], meal: 'dinner', sourceDate: '2026-11-14', targetDate: '2026-11-15' });
  assert.equal(emptyMeal.empty, true);
  assert.equal(emptyMeal.copied, 0);
  assert.match(emptyMeal.message, /dinner/i);

  const emptyDay = CY.copyResult({ sourceLogs: [], existingTargetLogs: [], sourceDate: '2026-11-14', targetDate: '2026-11-15' });
  assert.equal(emptyDay.empty, true);
  assert.equal(emptyDay.copied, 0);
});

test('copying a meal does not require other meals on the target day to be empty', () => {
  const existing = [{ meal: 'breakfast', food: 'x', foodName: 'Toast', servings: 1, calories: 80, isManual: false }];
  const r = CY.copyResult({ sourceLogs: yesterday, existingTargetLogs: existing, meal: 'lunch', sourceDate: '2026-11-14', targetDate: '2026-11-15' });
  assert.equal(r.empty, false);
  assert.equal(r.alreadyCopied, false);
  assert.equal(r.copied, 1);
  assert.equal(r.docs[0].foodName, 'Chicken');
});

test('double-tap does not duplicate already-copied items; missing items can still be copied', () => {
  const existing = [yesterday[1]];
  const again = CY.copyResult({ sourceLogs: yesterday, existingTargetLogs: existing, meal: 'lunch', sourceDate: '2026-11-14', targetDate: '2026-11-15' });
  assert.equal(again.alreadyCopied, true);
  assert.equal(again.copied, 0);

  const whole = CY.copyResult({ sourceLogs: yesterday, existingTargetLogs: existing, sourceDate: '2026-11-14', targetDate: '2026-11-15' });
  assert.equal(whole.copied, 1);
  assert.equal(whole.docs[0].foodName, 'Oats');
});

test('created docs include amount fields from the source log', () => {
  const doc = CY.toCreateFields('user1', '2026-11-15', yesterday[0]);
  assert.equal(doc.amount, 1);
  assert.equal(doc.amountUnit, 'serving');
  assert.equal(doc.amountLabel, '1 serving');
  assert.equal(doc.date, '2026-11-15');
  assert.equal(doc.isManual, false);
});

test('Food page has a per-meal Copy from yesterday control plus a whole-day option, with confirmation and a double-tap guard', () => {
  assert.match(html, /id="btn-copy-yesterday"/);
  assert.match(app, /data-copy-yesterday="\$\{meal\}"/);
  assert.match(app, /Copy from yesterday/);
  assert.match(app, /function copyFromYesterday/);
  assert.match(app, /copyYesterdayBusy/);
  assert.match(app, /if \(!confirm\(/);
  assert.match(app, /Nothing logged/);
  assert.match(app, /Already copied from yesterday/);
  assert.match(route, /CopyYesterday\.copyResult/);
  assert.match(route, /body\.meal/);
});
