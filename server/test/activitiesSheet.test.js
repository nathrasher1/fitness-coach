const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');

test('Workouts main screen has exact Select activities button', () => {
  assert.match(html, /id="btn-select-activities">Select activities<\/button>/);
  assert.match(html, /id="wo-activities-sheet"/);
  assert.match(html, /id="wo-program-activities"/);
  assert.match(html, /id="wo-recommended"/);
  // Suggested programs results stay on the main card
  const programsIdx = html.indexOf('id="wo-programs"');
  const sheetIdx = html.indexOf('id="wo-activities-sheet"');
  const btnIdx = html.indexOf('id="btn-select-activities"');
  assert.ok(btnIdx > 0 && programsIdx > btnIdx, 'programs list follows the button');
  assert.ok(sheetIdx > programsIdx, 'sheet markup comes after the programs list');
});

test('activities and recommended lifts live inside the sheet, not a separate main card', () => {
  const sheet = html.slice(html.indexOf('id="wo-activities-sheet"'), html.indexOf('id="wo-activities-sheet"') + 2500);
  assert.match(sheet, /id="wo-program-activities"/);
  assert.match(sheet, /id="wo-recommended"/);
  assert.match(sheet, /Recommended lifts/);
  // No standalone Recommended lifts card heading outside the sheet
  const outside = html.replace(sheet, '');
  assert.doesNotMatch(outside, /<h2>Recommended lifts<\/h2>/);
});

test('sheet open/close and retained selection helpers exist', () => {
  assert.match(app, /function openActivitiesSheet/);
  assert.match(app, /function closeActivitiesSheet/);
  assert.match(app, /Escape/);
  assert.match(app, /selectedProgramActivities/);
  assert.match(app, /updateActivitiesSummary/);
  // Closing must not clear checkboxes (no uncheck-all on close)
  assert.doesNotMatch(app, /closeActivitiesSheet[\s\S]{0,400}\.checked\s*=\s*false/);
});
