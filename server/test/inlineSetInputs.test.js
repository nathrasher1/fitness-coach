const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../client/styles.css'), 'utf8');

test('set LBS and REPS cells are type=text inputs with iOS-friendly inputmode and pattern', () => {
  assert.match(app, /<input type="text" inputmode="decimal" pattern="\[0-9\]\*\[.,\]\?\[0-9\]\*" class="set-val"/);
  assert.match(app, /<input type="text" inputmode="numeric" pattern="\[0-9\]\*" class="set-val"/);
  assert.match(app, /enterkeyhint="next"/);
  assert.match(app, /enterkeyhint="\$\{lastField \? 'done' : 'next'\}"/);
  // type=number cannot setSelectionRange on iOS
  assert.doesNotMatch(app, /class="set-val"[^>]*type="number"/);
  assert.doesNotMatch(app, /type="number"[^>]*class="set-val"/);
});

test('tapping a set value selects the existing text so typing replaces it', () => {
  assert.match(app, /function selectAllSetVal/);
  assert.match(app, /requestAnimationFrame\(\(\) => setTimeout\(run, 0\)\)/);
  assert.match(app, /el\.setSelectionRange\(0, len\)/);
  assert.match(app, /el\.select\(\)/);
  assert.match(app, /addEventListener\('focusin'/);
  assert.match(app, /dataset\.justFocused/);
});

test('values save on input and blur without re-rendering the table', () => {
  assert.match(app, /function applySetInput/);
  assert.match(app, /addEventListener\('input'/);
  assert.match(app, /addEventListener\('blur'/);
  assert.match(app, /scheduleDraftSave\(\)/);
  // Updating a cell must not remount inputs mid-keystroke
  const apply = app.slice(app.indexOf('function applySetInput'), app.indexOf('function selectAllSetVal'));
  assert.doesNotMatch(apply, /renderWorkoutExercises/);
  const marker = "getElementById('wo-exercise-list').addEventListener('input'";
  const start = app.indexOf(marker);
  assert.ok(start > 0, 'set-table input listener exists');
  const inputHandler = app.slice(start, app.indexOf("addEventListener('focusin'", start));
  assert.doesNotMatch(inputHandler, /renderWorkoutExercises/);
});

test('keyboard next/enter moves between set fields; checkmark button remains', () => {
  assert.match(app, /function focusNextSetVal/);
  assert.match(app, /#wo-exercise-list input\.set-val/);
  assert.match(app, /e\.key !== 'Enter'/);
  assert.match(app, /class="set-done \$\{s\.logged \? 'on' : ''\}" data-done="/);
  assert.match(app, /else if \(d\.done\)/);
});

test('expanded stepper panel and Same as last set / Done chrome are removed', () => {
  assert.doesNotMatch(app, /wx-editor/);
  assert.doesNotMatch(app, /Same as last set/);
  assert.doesNotMatch(app, /data-close-edit/);
  assert.doesNotMatch(app, /data-step=/);
  assert.doesNotMatch(app, /data-same=/);
  assert.doesNotMatch(app, /data-edit=/);
  assert.doesNotMatch(app, /woEditing/);
  assert.doesNotMatch(app, /woStep\(/);
  assert.doesNotMatch(css, /\.wx-editor/);
  assert.doesNotMatch(css, /\.step-btn/);
  assert.doesNotMatch(css, /\.step-input/);
});

test('adding a set still prefills weight, reps, and type from the previous set', () => {
  assert.match(
    app,
    /ex\.sets\.push\(\{ type: P\.setType\(last\) === 'warmup' \? 'working' : P\.setType\(last\), weight: last\.weight, reps: last\.reps, logged: false \}\)/
  );
});
