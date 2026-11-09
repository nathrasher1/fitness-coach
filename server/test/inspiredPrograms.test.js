const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  choosePrograms,
  parseDaysPerWeek,
  normalizeDaysPerWeek,
  CATALOG_DAY_OPTIONS,
  deriveCatalogDayOptions,
  syncCatalogDayOptions
} = require('../services/programPicker');
const { PROGRAMS, findCatalogProgram } = require('../routes/workouts');
const INSPIRED = require('../data/inspiredPrograms');

const CORE_IDS = [
  'full_body_3day', 'upper_lower', 'bjj_strength', 'football', 'softball', 'wakeboard',
  'striking', 'field_speed', 'court_jump', 'racket', 'endurance', 'swim_paddle', 'snow',
  'climbing', 'metcon', 'mobility_core', 'seated_upper'
];

const INSPIRED_IDS = INSPIRED.map((p) => p.id);

test('existing catalog IDs remain after inspired expansion', () => {
  const ids = new Set(PROGRAMS.map((p) => p.id));
  for (const id of CORE_IDS) assert.ok(ids.has(id), `missing core id ${id}`);
  for (const id of INSPIRED_IDS) assert.ok(ids.has(id), `missing inspired id ${id}`);
  assert.equal(ids.size, CORE_IDS.length + INSPIRED_IDS.length);
});

test('inspired programs have unique original names and day lists', () => {
  const names = new Set();
  for (const p of INSPIRED) {
    assert.ok(p.name && !/5\/3\/1|VPO-10|ATHLEAN|MASS Method Hypertrophy Phase/i.test(p.name), p.name);
    assert.ok(Array.isArray(p.days) && p.days.length >= 2);
    assert.ok(p.progression, p.id);
    assert.ok(p.progression.autoBehavior, p.id);
    assert.ok(p.progression.effort && p.progression.effortTeen, p.id);
    assert.ok(p.inspiration && p.inspiration.coaches.length, p.id);
    assert.ok(!names.has(p.name));
    names.add(p.name);
    for (const d of p.days) {
      assert.ok(d.name && d.exercises && d.exercises.length >= 3, `${p.id} ${d.name}`);
    }
  }
});

test('catalog day options match actual program day counts (includes 5)', () => {
  syncCatalogDayOptions(PROGRAMS);
  const derived = deriveCatalogDayOptions(PROGRAMS);
  assert.deepEqual([...CATALOG_DAY_OPTIONS], derived);
  assert.ok(derived.includes(2) && derived.includes(3) && derived.includes(4) && derived.includes(5));
  assert.equal(normalizeDaysPerWeek(5), 5);
  assert.equal(normalizeDaysPerWeek(6), null);
  assert.equal(parseDaysPerWeek({ daysPerWeek: '5' }), 5);
});

test('no activities still blank; strength activity can reach inspired plans', () => {
  assert.deepEqual(choosePrograms([], PROGRAMS), []);
  const any = choosePrograms(['strength'], PROGRAMS);
  const ids = any.map((r) => r.program.id);
  assert.ok(ids.includes('steady_strength_4day') || ids.includes('double_progress_2day'));
  const five = choosePrograms(['strength'], PROGRAMS, { daysPerWeek: 5 });
  assert.ok(five.every((r) => r.program.days.length === 5));
  assert.ok(five.some((r) => r.program.id === 'frequent_stimulus_5day'));
});

test('detail lookup works for inspired ids', () => {
  for (const id of INSPIRED_IDS) {
    const hit = findCatalogProgram(id);
    assert.ok(hit);
    assert.equal(hit.id, id);
    assert.ok(hit.progression);
  }
});

test('teen effort copy avoids failure / max-testing language', () => {
  for (const p of INSPIRED) {
    const teen = String(p.progression.effortTeen || '').toLowerCase();
    assert.ok(teen.length > 20, p.id);
    assert.doesNotMatch(teen, /\b1\s*rm\b|max[- ]?out|train to failure|go to failure|amrap/);
    assert.match(teen, /reserve|tank|clean|form|moderate|challenging/);
  }
});

test('client renders progression panel and dynamic day filter', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
  assert.match(app, /function progressionPanelHtml/);
  assert.match(app, /function renderDaysFilter/);
  assert.match(app, /function ensureCatalogDayOptions/);
  assert.match(app, /progressionPanelHtml\(p\)/);
  assert.match(app, /ageGroup === 'teen'/);
  assert.match(app, /effortTeen/);
});

test('sources file documents coaches without invented quotes', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../docs/inspired-routines-sources.md'), 'utf8');
  assert.match(src, /Marc Lobliner/);
  assert.match(src, /Judd Lienhard/);
  assert.match(src, /Jeff Cavaliere/);
  assert.match(src, /Sean Nalewanyj/);
  assert.match(src, /Mike Israetel/);
  assert.match(src, /Jeremy Ethier/);
  assert.match(src, /not affiliated/i);
  assert.doesNotMatch(src, /"I always tell my athletes/);
});

test('Athlete Strength Builder display name; stable id unchanged', () => {
  const p = findCatalogProgram('athlete_mass_3day');
  assert.ok(p);
  assert.equal(p.name, 'Athlete Strength Builder');
  assert.doesNotMatch(p.name, /MASS Builder/i);
});

test('5/3/1 BBB credited as Wendler origin; Lobliner not claimed as method author', () => {
  const p = findCatalogProgram('steady_strength_4day');
  assert.ok(p);
  const coaches = (p.inspiration.coaches || []).map((c) => c.name).join(' | ');
  assert.match(coaches, /Wendler/i);
  assert.match(coaches, /Lobliner/i);
  assert.match(p.notes, /Wendler/i);
  assert.match(p.notes, /not a Lobliner|Lobliner.?s own verified|discusses that method/i);
  const lob = p.inspiration.coaches.find((c) => /Lobliner/i.test(c.name));
  assert.ok(lob);
  assert.ok(lob.sources.some((u) => /time-under-tension-bad/.test(u)));
  assert.ok(!lob.principles.some((pr) => /5\/3\/1|Boring But Big|training max bumps/i.test(pr)));
});

test('compound ladder keeps verified Lobliner VPO-10 progression principle', () => {
  const p = findCatalogProgram('compound_ladder_3day');
  const lob = p.inspiration.coaches.find((c) => /Lobliner/i.test(c.name));
  assert.ok(lob);
  assert.ok(lob.sources.some((u) => /vpo-10/.test(u)));
  assert.ok(lob.principles.some((pr) => /complete the planned sets|finish planned|repeat the weight/i.test(pr)));
});

test('client teen-sanitizes shared progression fields and clarifies auto vs advisory', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
  assert.match(app, /function teenSanitizeProgressionText/);
  assert.match(app, /What the app automates/);
  assert.match(app, /If advisory text conflicts/);
  assert.match(app, /teenSanitizeProgressionText\(text\)/);
});
