const test = require('node:test');
const assert = require('node:assert/strict');
const { parseActivities, choosePrograms } = require('../services/programPicker');
const { PROGRAMS } = require('../routes/workouts');

test('parseActivities: empty query → []', () => {
  assert.deepEqual(parseActivities({}), []);
  assert.deepEqual(parseActivities({ activity: '', focus: '' }), []);
});

test('parseActivities: singular, comma list, repeated, and focus alias', () => {
  assert.deepEqual(parseActivities({ activity: 'Basketball' }), ['Basketball']);
  assert.deepEqual(parseActivities({ activities: 'Basketball,Soccer' }), ['Basketball', 'Soccer']);
  assert.deepEqual(parseActivities({ activity: ['Basketball', 'Soccer'] }), ['Basketball', 'Soccer']);
  assert.deepEqual(parseActivities({ focus: 'court' }), ['court']);
  assert.deepEqual(parseActivities({ activities: 'Basketball', activity: 'Basketball' }), ['Basketball']);
});

test('no activities selected → no suggested programs', () => {
  assert.deepEqual(choosePrograms([], PROGRAMS), []);
  assert.deepEqual(choosePrograms(null, PROGRAMS), []);
  assert.deepEqual(choosePrograms(['', '  '], PROGRAMS), []);
});

test('one activity returns programs for that activity (not the full catalog)', () => {
  const picks = choosePrograms(['Basketball'], PROGRAMS);
  assert.ok(picks.length > 0);
  assert.ok(picks.length < PROGRAMS.length);
  assert.ok(picks.some((r) => r.program.id === 'court_jump'));
  assert.ok(picks.every((r) => r.why === 'Basketball' || r.why == null));
  // General backup still present
  assert.ok(picks.some((r) => r.program.id === 'full_body_3day'));
});

test('multiple activities union and dedupe (not intersection)', () => {
  const one = choosePrograms(['Basketball'], PROGRAMS);
  const two = choosePrograms(['Running'], PROGRAMS);
  const both = choosePrograms(['Basketball', 'Running'], PROGRAMS);
  assert.ok(both.length >= Math.max(one.length, two.length));
  const ids = both.map((r) => r.program.id);
  assert.equal(ids.length, new Set(ids).size, 'deduped by program id');
  assert.ok(ids.includes('court_jump'));
  assert.ok(ids.includes('endurance'));
  // Deselection of one still leaves the other (caller passes remaining list)
  const onlyRun = choosePrograms(['Running'], PROGRAMS);
  assert.ok(onlyRun.some((r) => r.program.id === 'endurance'));
  assert.ok(!onlyRun.some((r) => r.program.id === 'court_jump' && r.score > 0));
});

test('deselecting all activities empties suggestions again', () => {
  assert.ok(choosePrograms(['Soccer', 'Tennis'], PROGRAMS).length > 0);
  assert.deepEqual(choosePrograms([], PROGRAMS), []);
});

test('why labels merge when two activities share a program', () => {
  const both = choosePrograms(['Basketball', 'Volleyball'], PROGRAMS);
  const court = both.find((r) => r.program.id === 'court_jump');
  assert.ok(court);
  assert.match(court.why, /Basketball/);
  assert.match(court.why, /Volleyball/);
});
