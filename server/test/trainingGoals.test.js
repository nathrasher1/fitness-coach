const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../../client/lib/progression');

const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const workouts = fs.readFileSync(path.join(__dirname, '../routes/workouts.js'), 'utf8');

test('default ranges stay unchanged when no training goal is set', () => {
  assert.deepEqual(P.FOCUS_RANGES.hypertrophy, { low: 8, high: 12, bump: true });
  assert.deepEqual(P.FOCUS_RANGES.strength, { low: 3, high: 6, bump: true });
  assert.deepEqual(P.FOCUS_RANGES.power, { low: 2, high: 5, bump: true });
  assert.deepEqual(P.FOCUS_RANGES.endurance, { low: 15, high: 20, bump: false });
  const def = P.rangeFor({});
  assert.equal(def.low, 8);
  assert.equal(def.high, 12);
  assert.equal(def.focus, 'hypertrophy');
  assert.equal(def.goal, false);
  assert.equal(P.goalFromSettings({ trainingFocus: [] }), null);
  assert.equal(P.goalFromSettings({}), null);
  assert.equal(P.goalFromSettings({ trainingFocus: ['conditioning'] }), null);
});

test('choosing a training goal applies evidence-based rep, set, and rest guidance', () => {
  const power = P.rangeFor({ focus: 'power' });
  assert.equal(power.low, 1);
  assert.equal(power.high, 5);
  assert.equal(power.goal, true);
  assert.equal(power.defaultSets, 4);
  assert.equal(power.restSec, 180);
  assert.match(power.restLabel, /3–5/);

  const strength = P.rangeFor({ focus: 'strength' });
  assert.equal(strength.low, 1);
  assert.equal(strength.high, 6);
  assert.equal(strength.restSec, 180);

  const hyp = P.rangeFor({ focus: 'hypertrophy' });
  assert.equal(hyp.low, 6);
  assert.equal(hyp.high, 12);
  assert.equal(hyp.defaultSets, 3);
  assert.equal(hyp.restSec, 90);
  assert.match(P.TRAINING_GOALS.hypertrophy.note, /6–30/);

  const end = P.rangeFor({ focus: 'endurance' });
  assert.equal(end.low, 12);
  assert.equal(end.high, 20);
  assert.equal(end.bump, false);
  assert.equal(end.restSec, 45);
  assert.equal(end.defaultSets, 3);
});

test('explicit exercise rep range still wins over the training goal', () => {
  const range = P.rangeFor({ focus: 'strength', repMin: 8, repMax: 10 });
  assert.equal(range.low, 8);
  assert.equal(range.high, 10);
  assert.equal(range.focus, 'strength');
});

test('goalFromSettings uses the first recognized training goal', () => {
  assert.equal(P.goalFromSettings({ trainingFocus: ['strength'] }), 'strength');
  assert.equal(P.goalFromSettings({ trainingFocus: ['conditioning', 'power'] }), 'power');
  assert.equal(P.normalizeTrainingGoal('Hypertrophy'), 'hypertrophy');
  assert.equal(P.normalizeTrainingGoal('conditioning'), null);
});

test('Goals page and Settings offer a single training-goal choice', () => {
  assert.match(html, /id="goal-training-focus"/);
  assert.match(html, />Training goal</);
  assert.match(html, /id="training-focus"/);
  assert.match(app, /type="radio" class="focus-check"/);
  assert.match(app, /function persistTrainingFocus/);
  assert.match(app, /function trainingGoalBannerHtml/);
  assert.match(app, /trainingGoalBannerHtml\(/);
  assert.match(app, /goal\.defaultSets/);
  assert.match(app, /goalRest/);
  assert.match(workouts, /P\.goalFromSettings\(settings\)/);
  assert.match(workouts, /goalRest/);
  assert.doesNotMatch(app, /const TRAINING_FOCUS = \['Strength', 'Power', 'Hypertrophy', 'Conditioning', 'Endurance'\]/);
});
