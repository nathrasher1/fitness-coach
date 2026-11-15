const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../routes/workouts.js'), 'utf8');

function between(src, start, end) {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i);
  assert.ok(i >= 0, 'missing start: ' + start);
  assert.ok(j > i, 'missing end after ' + start);
  return src.slice(i, j);
}

test('Workout page no longer has a Recent Workouts / Recent training section', () => {
  const workouts = between(html, '<section id="workouts"', '<section id="body"');
  assert.doesNotMatch(workouts, /Recent Workouts/);
  assert.doesNotMatch(workouts, /Recent training/i);
  assert.doesNotMatch(workouts, /id="wo-history"/);
  assert.match(workouts, /id="wo-exercise-list"/);
  assert.match(workouts, /id="wo-routines"/);
  assert.doesNotMatch(app, /function loadWorkoutHistory/);
  assert.doesNotMatch(app, /wo-history/);
});

test('Diary still loads and displays workouts; list endpoints remain', () => {
  assert.match(app, /async function loadCalendar/);
  assert.match(app, /api\('\/workouts\?limit=60'\)/);
  assert.match(app, /api\('\/workouts\?limit=100'\)/);
  assert.match(app, /data-sec="wo">Workouts/);
  assert.match(app, /No workouts/);
  assert.match(routes, /router\.get\('\/'/);
  assert.match(routes, /GET \/api\/workouts – recent workout logs/);
});
