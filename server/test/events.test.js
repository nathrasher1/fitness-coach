const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../services/events');

describe('event presets and normalization', () => {
  it('includes practice sports plus lifting and combat presets', () => {
    const sports = E.sportPresets();
    assert.ok(sports.includes('Wrestling'));
    assert.ok(sports.includes('Running'));
    assert.ok(sports.includes('Powerlifting'));
    assert.ok(sports.includes('Brazilian jiu-jitsu'));
    assert.ok(sports.includes('Other'));
    assert.ok(E.presets().types.some((t) => t.key === 'meet'));
    assert.ok(E.presets().resultKinds.some((k) => k.key === 'lifting'));
  });

  it('infers result kind from sport and event type', () => {
    assert.equal(E.inferResultKind('Powerlifting', 'meet'), 'lifting');
    assert.equal(E.inferResultKind('Olympic lifting', 'meet'), 'lifting');
    assert.equal(E.inferResultKind('Running', 'race'), 'race');
    assert.equal(E.inferResultKind('Swimming', 'meet'), 'race');
    assert.equal(E.inferResultKind('Wrestling', 'match'), 'match');
    assert.equal(E.inferResultKind('Brazilian jiu-jitsu', 'invitational'), 'match');
    assert.equal(E.inferResultKind('Soccer', 'game'), 'generic');
  });

  it('normalizes a valid one-off event', () => {
    const n = E.normalizeEvent({
      name: 'Winter Open', sport: 'Powerlifting', type: 'meet',
      date: '2026-12-12', time: '09:30', place: 'City Hall', weightClassLbs: 165
    });
    assert.equal(n.error, undefined);
    assert.equal(n.resultKind, 'lifting');
    assert.equal(n.weightClassLbs, 165);
    assert.equal(n.time, '09:30');
  });

  it('rejects a bad date, type, or class', () => {
    assert.ok(E.normalizeEvent({ name: 'X', sport: 'Running', type: 'race', date: 'nope' }).error);
    assert.ok(E.normalizeEvent({ name: 'X', sport: 'Running', type: 'sprint', date: '2026-12-12' }).error);
    assert.ok(E.normalizeEvent({ name: '', sport: 'Running', type: 'race', date: '2026-12-12' }).error);
    assert.ok(E.normalizeEvent({ name: 'X', sport: 'Running', type: 'race', date: '2026-12-12', weightClassLbs: 9000 }).error);
  });

  it('uses a custom sport when Other is selected', () => {
    const n = E.normalizeEvent({
      name: 'Club night', sport: 'Other', customSport: 'Fencing', type: 'match', date: '2026-12-01'
    });
    assert.equal(n.sport, 'Fencing');
    assert.equal(n.resultKind, 'match');
  });

  it('parses and formats race clocks', () => {
    assert.equal(E.parseClock('21:45'), 1305);
    assert.equal(E.parseClock('1:02:03'), 3723);
    assert.equal(E.parseClock(1305), 1305);
    assert.equal(E.formatClock(1305), '21:45');
    assert.equal(E.formatClock(3723), '1:02:03');
  });

  it('normalizes lifting attempts and totals the best good lift of each', () => {
    const r = E.normalizeResult('lifting', {
      attempts: [
        { lift: 'squat', attempt: 1, weightLbs: 315, outcome: 'good' },
        { lift: 'squat', attempt: 2, weightLbs: 335, outcome: 'good' },
        { lift: 'squat', attempt: 3, weightLbs: 345, outcome: 'no-lift' },
        { lift: 'bench', attempt: 1, weightLbs: 200, outcome: 'good' },
        { lift: 'deadlift', attempt: 1, weightLbs: 405, outcome: 'good' }
      ],
      notes: 'Opened light'
    });
    assert.equal(r.kind, 'lifting');
    assert.equal(E.liftingTotal(r.attempts), 940);
    assert.equal(E.hasResult(r), true);
  });

  it('normalizes a race result with splits', () => {
    const r = E.normalizeResult('race', {
      distance: '5K', time: '21:45', splits: [{ label: 'Mile 1', time: '6:50' }, { label: 'Mile 2', time: '7:00' }]
    });
    assert.equal(r.timeSec, 1305);
    assert.equal(r.splits.length, 2);
    assert.equal(r.splits[0].timeSec, 410);
  });

  it('normalizes a match record', () => {
    const r = E.normalizeResult('match', {
      outcome: 'win', method: 'submission', opponent: 'A. Smith', score: 'Ezequiel'
    });
    assert.equal(r.outcome, 'win');
    assert.equal(r.method, 'submission');
    assert.equal(r.opponent, 'A. Smith');
  });

  it('counts down in plain words', () => {
    assert.deepEqual(E.countdown('2026-11-25', '2026-11-25'), { days: 0, label: 'Today' });
    assert.deepEqual(E.countdown('2026-11-25', '2026-11-26'), { days: 1, label: 'Tomorrow' });
    assert.equal(E.countdown('2026-11-25', '2026-12-02').label, 'In 7 days');
    assert.equal(E.countdown('2026-11-25', '2026-11-20').label, '5 days ago');
  });

  it('picks the last similar event by sport first, then type', () => {
    const ev = { name: 'December 5K', sport: 'Running', type: 'race', date: '2026-12-06' };
    const others = [
      { name: 'Soccer final', sport: 'Soccer', type: 'game', date: '2026-12-01' },
      { name: 'Thanksgiving 5K', sport: 'Running', type: 'race', date: '2026-11-27' },
      { name: 'Fall 5K', sport: 'Running', type: 'race', date: '2026-10-12' }
    ];
    const prev = E.findSimilar(ev, others);
    assert.equal(prev.name, 'Thanksgiving 5K');
  });

  it('compares race times and lifting totals', () => {
    const race = E.compareResults(
      { name: 'Now', result: { kind: 'race', timeSec: 1300 } },
      { name: 'Last 5K', result: { kind: 'race', timeSec: 1360 } }
    );
    assert.equal(race.timeDeltaSec, -60);
    assert.match(race.summary, /1:00 faster than Last 5K/);

    const lifts = E.compareResults(
      { name: 'Open', result: { kind: 'lifting', attempts: [
        { lift: 'squat', outcome: 'good', weightLbs: 300 },
        { lift: 'bench', outcome: 'good', weightLbs: 200 },
        { lift: 'deadlift', outcome: 'good', weightLbs: 400 }
      ] } },
      { name: 'Summer Open', result: { kind: 'lifting', attempts: [
        { lift: 'squat', outcome: 'good', weightLbs: 290 },
        { lift: 'bench', outcome: 'good', weightLbs: 200 },
        { lift: 'deadlift', outcome: 'good', weightLbs: 390 }
      ] } }
    );
    assert.equal(lifts.totalDeltaLbs, 20);
    assert.match(lifts.summary, /20 lbs more than Summer Open/);
  });
});
