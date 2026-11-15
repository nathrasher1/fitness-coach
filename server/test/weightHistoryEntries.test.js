const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '../../client/app.js'), 'utf8');

test('Weight History month counts use entry/entries (not entryies)', () => {
  assert.match(app, /\$\{entries\.length\} \$\{entries\.length === 1 \? 'entry' : 'entries'\}/);
  assert.doesNotMatch(app, /entry\$\{entries\.length === 1 \? '' : 'ies'\}/);
  assert.doesNotMatch(app, /entryies/);
});
