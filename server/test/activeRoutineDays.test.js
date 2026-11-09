const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  choosePrograms,
  parseDaysPerWeek,
  normalizeDaysPerWeek,
  CATALOG_DAY_OPTIONS
} = require('../services/programPicker');
const { PROGRAMS } = require('../routes/workouts');

test('catalog day options are exactly 2, 3, 4', () => {
  assert.deepEqual(CATALOG_DAY_OPTIONS, [2, 3, 4]);
  const counts = new Set(PROGRAMS.map((p) => p.days.length));
  assert.deepEqual([...counts].sort((a, b) => a - b), [2, 3, 4]);
});

test('normalizeDaysPerWeek: any / invalid → null; 2–4 kept', () => {
  assert.equal(normalizeDaysPerWeek(null), null);
  assert.equal(normalizeDaysPerWeek('any'), null);
  assert.equal(normalizeDaysPerWeek(5), null);
  assert.equal(normalizeDaysPerWeek(2), 2);
  assert.equal(parseDaysPerWeek({ daysPerWeek: '3' }), 3);
  assert.equal(parseDaysPerWeek({}, 4), 4);
  assert.equal(parseDaysPerWeek({ daysPerWeek: 'any' }, 3), null);
});

test('no activities still yields no programs even with a days filter', () => {
  assert.deepEqual(choosePrograms([], PROGRAMS, { daysPerWeek: 3 }), []);
  assert.deepEqual(choosePrograms(null, PROGRAMS, { daysPerWeek: 2 }), []);
});

test('days filter is exact match (no invented shorter plans)', () => {
  const any = choosePrograms(['Basketball'], PROGRAMS);
  const two = choosePrograms(['Basketball'], PROGRAMS, { daysPerWeek: 2 });
  const four = choosePrograms(['Basketball'], PROGRAMS, { daysPerWeek: 4 });
  assert.ok(any.some((r) => r.program.id === 'court_jump'));
  assert.ok(any.some((r) => r.program.id === 'full_body_3day')); // 3-day backup in "any"
  assert.ok(two.every((r) => r.program.days.length === 2));
  assert.ok(two.some((r) => r.program.id === 'court_jump'));
  assert.ok(!two.some((r) => r.program.id === 'full_body_3day'));
  assert.equal(four.length, 0); // Basketball has no 4-day match
});

test('multi-activity union then days filter', () => {
  const both = choosePrograms(['Basketball', 'Running'], PROGRAMS, { daysPerWeek: 2 });
  const ids = both.map((r) => r.program.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.includes('court_jump'));
  assert.ok(ids.includes('endurance'));
  assert.ok(both.every((r) => r.program.days.length === 2));
});

test('HTML: Home active routine card + days filter in Select activities sheet', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
  assert.match(html, /id="active-routine-card"/);
  assert.match(html, /id="btn-select-activities">Select activities</);
  assert.match(html, /id="wo-days-filter"/);
  assert.match(html, /name="wo-days" value="2"/);
  const sheet = html.slice(html.indexOf('id="wo-activities-sheet"'));
  assert.match(sheet, /wo-days-filter/);
  assert.match(sheet, /wo-program-activities/);
});

test('Settings schema adds activeRoutine and suggestedDaysPerWeek additively', () => {
  const src = fs.readFileSync(path.join(__dirname, '../models/Settings.js'), 'utf8');
  assert.match(src, /activeRoutine:/);
  assert.match(src, /suggestedDaysPerWeek:/);
  assert.match(src, /enum: \['program', 'routine'\]/);
});
