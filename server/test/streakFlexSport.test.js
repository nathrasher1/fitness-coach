const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeStreak, resolveSchedule } = require('../services/streak');

describe('streak with flex days and sport sessions', () => {
  const schedule = resolveSchedule({ trainingDays: [1, 2, 3, 4, 5], restSkipsPerWeek: 1 }, null); // Mon-Fri
  const today = '2026-11-06'; // Friday

  it('counts sport session dates as workouts', () => {
    const workouts = new Set(['2026-11-06', '2026-11-05', '2026-11-04']);
    const out = computeStreak({ workouts, rests: new Set(), flexes: new Set(), practiceDays: [], today, schedule });
    assert.equal(out.streak, 3);
    assert.equal(out.todayDone, true);
  });

  it('flex day never breaks streak even mid-week', () => {
    // Fri+Thu trained, Wed flex (no workout), Tue+Mon trained → streak 4 (flex bridges, does not increment)
    const out = computeStreak({
      workouts: new Set(['2026-11-06', '2026-11-05', '2026-11-03', '2026-11-02']),
      rests: new Set(),
      flexes: new Set(['2026-11-04']),
      practiceDays: [],
      today,
      schedule
    });
    assert.equal(out.streak, 4); // flex bridges the gap but does not itself increment
    assert.equal(out.todayFlex, false);
  });

  it('marks todayFlex when today is a flex day', () => {
    const out = computeStreak({
      workouts: new Set(),
      rests: new Set(),
      flexes: new Set([today]),
      practiceDays: [],
      today,
      schedule
    });
    assert.equal(out.todayFlex, true);
    assert.equal(out.plannedRestToday, true);
    assert.equal(out.canTakeRest, false);
  });

  it('weekend without training does not break Mon-Fri schedule', () => {
    const mon = '2026-11-02';
    const out = computeStreak({
      workouts: new Set(['2026-11-02', '2026-10-30']), // Mon + prior Fri
      rests: new Set(),
      flexes: new Set(),
      practiceDays: [],
      today: mon,
      schedule
    });
    assert.equal(out.streak, 2);
  });
});
