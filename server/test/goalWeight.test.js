const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const GW = require('../services/goalWeight');

test('goal weight is derived from start ± amount without requiring a stored target', () => {
  assert.equal(GW.computedGoalWeightLbs({ type: 'lose', amountLbs: 10, startWeight: 190 }), 180);
  assert.equal(GW.computedGoalWeightLbs({ type: 'gain', amountLbs: 8, startWeight: 140 }), 148);
  assert.equal(GW.computedGoalWeightLbs({ type: 'maintain', amountLbs: 0, startWeight: 165 }), 165);
});

test('stored targetWeightLbs wins, so existing amountLbs is not rewritten on read', () => {
  assert.equal(GW.computedGoalWeightLbs({
    type: 'lose', amountLbs: 10, startWeight: 190, targetWeightLbs: 175
  }), 175);
});

test('amountLbs is derived from goal weight and start/current weight', () => {
  assert.equal(GW.amountLbsFromGoalWeight({ type: 'lose', goalWeightLbs: 180, startWeight: 190 }), 10);
  assert.equal(GW.amountLbsFromGoalWeight({ type: 'gain', goalWeightLbs: 160, currentWeightLbs: 150 }), 10);
  assert.equal(GW.amountLbsFromGoalWeight({ type: 'maintain', goalWeightLbs: 150, startWeight: 150 }), 0);
});

test('inferGoalType uses current weight, falling back to starting weight', () => {
  assert.equal(GW.inferGoalType({ goalWeightLbs: 180, currentWeightLbs: 190 }), 'lose');
  assert.equal(GW.inferGoalType({ goalWeightLbs: 200, currentWeightLbs: 190 }), 'gain');
  assert.equal(GW.inferGoalType({ goalWeightLbs: 190, currentWeightLbs: 190 }), 'maintain');
  assert.equal(GW.inferGoalType({ goalWeightLbs: 180, startWeight: 190 }), 'lose');
  // Current wins over a conflicting start weight.
  assert.equal(GW.inferGoalType({ goalWeightLbs: 185, startWeight: 170, currentWeightLbs: 190 }), 'lose');
  assert.equal(GW.inferGoalType({ goalWeightLbs: 200, startWeight: 210, currentWeightLbs: 190 }), 'gain');
});

test('inferGoalType treats a difference within 0.5 lb as maintain', () => {
  assert.equal(GW.inferGoalType({ goalWeightLbs: 190.5, currentWeightLbs: 190 }), 'maintain');
  assert.equal(GW.inferGoalType({ goalWeightLbs: 189.5, currentWeightLbs: 190 }), 'maintain');
  assert.equal(GW.inferGoalType({ goalWeightLbs: 190.51, currentWeightLbs: 190 }), 'gain');
  assert.equal(GW.inferGoalType({ goalWeightLbs: 189.49, currentWeightLbs: 190 }), 'lose');
});

test('validateGoalWeight no longer rejects a type/number mismatch; it only requires a goal and a reference weight', () => {
  const ok = GW.validateGoalWeight({ goalWeightLbs: 200, startWeight: 190 });
  assert.equal(ok.ok, true);
  const alsoOk = GW.validateGoalWeight({ goalWeightLbs: 180, currentWeightLbs: 190 });
  assert.equal(alsoOk.ok, true);
  const missingGoal = GW.validateGoalWeight({ startWeight: 190 });
  assert.equal(missingGoal.ok, false);
  const missingRef = GW.validateGoalWeight({ goalWeightLbs: 180 });
  assert.equal(missingRef.ok, false);
});

test('Goal schema keeps amountLbs and adds optional targetWeightLbs only', () => {
  const model = fs.readFileSync(path.join(__dirname, '../models/Goal.js'), 'utf8');
  assert.match(model, /amountLbs/);
  assert.match(model, /targetWeightLbs/);
  const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
  assert.match(html, />Goal weight</);
  assert.doesNotMatch(html, />Amount \(lbs\)</);
});

test('Goals page has no gain/maintain/lose dropdown; type is inferred in markup copy', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
  assert.doesNotMatch(html, /id="goal-type"/);
  assert.doesNotMatch(html, />Goal type</);
  assert.doesNotMatch(html, /<option value="lose">Lose weight</);
  assert.match(html, /inferred from your current or starting weight/);
  const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
  assert.doesNotMatch(app, /goal-type/);
  const preview = fs.readFileSync(path.join(__dirname, '../../preview/goal-weight-preview.html'), 'utf8');
  assert.doesNotMatch(preview, />Goal type</);
  assert.doesNotMatch(preview, /<select>/);
});
