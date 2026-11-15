const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../client/styles.css'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../routes/workouts.js'), 'utf8');

test('Diary day detail can delete a logged workout with confirmation and then refreshes', () => {
  assert.match(app, /async function showDayDetail/);
  assert.match(app, /data-delete-workout=/);
  assert.match(app, /function deleteDiaryLoggedWorkout/);
  assert.match(app, /Delete this workout\?/);
  assert.match(app, /method: 'DELETE'/);
  assert.match(app, /\/workouts\/\$\{id\}/);
  assert.match(app, /showDayDetail\(daySessions\.date, \{ openSection: 'wo' \}\)/);
  assert.match(app, /loadDashboard\(\)/);
  assert.match(app, /loadCalendar\(\)/);
  assert.match(css, /\.day-wo-item/);
  assert.match(routes, /router\.delete\('\/:id'/);
});
