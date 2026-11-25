const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');

test('weight log input is type=text with decimal inputmode, pattern, and select-all', () => {
  assert.match(html, /id="weight-value"/);
  const start = html.indexOf('id="weight-value"');
  const tag = html.slice(html.lastIndexOf('<input', start), html.indexOf('>', start) + 1);
  assert.match(tag, /type="text"/);
  assert.match(tag, /inputmode="decimal"/);
  assert.match(tag, /pattern="\[0-9\]\*\[.,\]\?\[0-9\]\*"/);
  assert.match(tag, /data-select-all="1"/);
  assert.doesNotMatch(tag, /type="number"/);
  assert.match(app, /bindSelectAll\(document\.getElementById\('weight'\)\)/);
  assert.match(app, /function fromInputWeight/);
  assert.match(app, /\.replace\(',', '\.'\)/);
});
