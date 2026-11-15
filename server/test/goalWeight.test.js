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

test('validateGoalWeight rejects a lose/gain direction that does not match the numbers', () => {
  const bad = GW.validateGoalWeight({ type: 'lose', goalWeightLbs: 200, startWeight: 190 });
  assert.equal(bad.ok, false);
  const ok = GW.validateGoalWeight({ type: 'lose', goalWeightLbs: 180, startWeight: 190 });
  assert.equal(ok.ok, true);
});

test('Goal schema keeps amountLbs and adds optional targetWeightLbs only', () => {
  const model = fs.readFileSync(path.join(__dirname, '../models/Goal.js'), 'utf8');
  assert.match(model, /amountLbs/);
  assert.match(model, /targetWeightLbs/);
  const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
  assert.match(html, />Goal weight</);
  assert.doesNotMatch(html, />Amount \(lbs\)</);
});
