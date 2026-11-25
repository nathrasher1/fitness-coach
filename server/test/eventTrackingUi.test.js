const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'client/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'client/events.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'client/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'client/styles.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8');

describe('event tracking UI and wiring', () => {
  it('adds a next-event card and readiness check-in on Home', () => {
    assert.match(html, /id="next-event-card"/);
    assert.match(html, /id="readiness-card"/);
    assert.match(html, /Readiness today/);
    assert.match(js, /refreshHome/);
    assert.match(app, /Events\.refreshHome/);
  });

  it('shows events on the Diary calendar with an add button and a gold pip', () => {
    assert.match(html, /id="cal-add-event"/);
    assert.match(html, /Events show a gold pip/);
    assert.match(app, /Events\.markCalendar/);
    assert.match(app, /Events\.daySectionHtml/);
    assert.match(css, /\.cal-day \.cal-event/);
  });

  it('opens a sheet for event details, results, recap, and weight class', () => {
    assert.match(html, /id="event-sheet"/);
    assert.match(html, /script src="events.js"/);
    assert.match(js, /openEventSheet/);
    assert.match(js, /Result template/);
    assert.match(js, /Lifts and attempts|Attempts/);
    assert.match(js, /Finish time/);
    assert.match(js, /Opponent/);
    assert.match(js, /Compared with/);
    assert.match(js, /Weight class \(optional\)/);
    assert.match(js, /never suggest a crash cut or dehydration/);
    assert.match(js, /Members under 18 don't get cutting guidance/);
  });

  it('mounts events and readiness API routes', () => {
    assert.match(index, /app\.use\('\/api\/events'/);
    assert.match(index, /app\.use\('\/api\/readiness'/);
  });
});
