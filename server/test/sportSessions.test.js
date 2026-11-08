const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const SS = require('../services/sportSessions');

describe('sportSessions', () => {
  it('computes training load as duration × effort', () => {
    assert.equal(SS.trainingLoad(60, 7), 420);
    assert.equal(SS.trainingLoad(45.5, 5), 227.5);
    assert.equal(SS.trainingLoad(0, 5), null);
    assert.equal(SS.trainingLoad(30, 0), null);
  });

  it('estimates active kcal from MET × effort', () => {
    const easy = SS.estimateActiveKcal({ sport: 'Golf', durationMin: 60, effort: 3, weightLbs: 154 });
    const hard = SS.estimateActiveKcal({ sport: 'Basketball', durationMin: 60, effort: 9, weightLbs: 154 });
    assert.ok(easy > 0 && hard > easy);
  });

  it('normalizes a valid session', () => {
    const n = SS.normalizeSession({
      date: '2026-11-06', sport: 'Soccer', durationMin: 90, effort: 8, drills: 'Sprints'
    });
    assert.equal(n.error, undefined);
    assert.equal(n.sport, 'Soccer');
    assert.equal(n.trainingLoad, 720);
    assert.equal(n.drills, 'Sprints');
  });

  it('rejects bad duration / effort / date', () => {
    assert.ok(SS.normalizeSession({ date: 'nope', sport: 'Soccer', durationMin: 30, effort: 5 }).error);
    assert.ok(SS.normalizeSession({ date: '2026-11-06', sport: 'Soccer', durationMin: 0, effort: 5 }).error);
    assert.ok(SS.normalizeSession({ date: '2026-11-06', sport: 'Soccer', durationMin: 30, effort: 11 }).error);
  });

  it('uses custom sport when Other is selected', () => {
    const n = SS.normalizeSession({
      date: '2026-11-06', sport: 'Other', customSport: 'Quidditch', durationMin: 40, effort: 6
    });
    assert.equal(n.sport, 'Quidditch');
  });

  it('normalizes practice days', () => {
    assert.deepEqual(SS.normalizePracticeDays([3, 1, 1, 5]), [1, 3, 5]);
    assert.equal(SS.normalizePracticeDays('nope'), null);
  });
});
