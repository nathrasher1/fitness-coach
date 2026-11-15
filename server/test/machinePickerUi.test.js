const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const workouts = fs.readFileSync(path.join(__dirname, '../routes/workouts.js'), 'utf8');

test('exercise picker has a Machine filter chip wired to the equipment search', () => {
  assert.match(html, /id="wo-ex-filter-machine"/);
  assert.match(html, />Machine</);
  assert.match(app, /function runExerciseSearch/);
  assert.match(app, /params\.set\('equipment', 'machine,cable'\)/);
  assert.match(app, /wo-ex-filter-machine/);
  assert.match(workouts, /exerciseSearchFilter/);
  assert.match(workouts, /exerciseSearchLimit/);
});

test('new machine exercises are inserted on startup without editing existing ones', () => {
  assert.match(index, /ensureBuiltInExercises/);
  assert.match(index, /Insert-only/);
});
