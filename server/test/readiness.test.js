const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../services/readiness');

describe('readiness check-ins', () => {
  it('normalizes 1–5 ratings and optional notes', () => {
    const n = R.normalize({ sleep: 4, soreness: '2', mood: 5, energy: 3, notes: 'Felt fresh' }, '2026-11-25');
    assert.equal(n.error, undefined);
    assert.equal(n.sleep, 4);
    assert.equal(n.soreness, 2);
    assert.equal(n.notes, 'Felt fresh');
  });

  it('allows a partial check-in and rejects empty or invalid ones', () => {
    const ok = R.normalize({ energy: 3 }, '2026-11-25');
    assert.equal(ok.energy, 3);
    assert.equal(ok.sleep, null);
    assert.ok(R.normalize({}, '2026-11-25').error);
    assert.ok(R.normalize({ sleep: 8 }, '2026-11-25').error);
    assert.ok(R.normalize({ sleep: 4 }, 'nope').error);
  });

  it('view keeps blanks as null, never zero', () => {
    const v = R.view({ date: '2026-11-25', sleep: 4, soreness: null, mood: undefined, energy: 3, notes: '' });
    assert.equal(v.soreness, null);
    assert.equal(v.mood, null);
    assert.equal(v.sleep, 4);
  });
});
