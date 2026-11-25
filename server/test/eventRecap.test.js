const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Recap = require('../services/eventRecap');

describe('post-event recap', () => {
  it('summarizes the week of training, food, weight, and readiness before an event', () => {
    const lead = Recap.summarizeLeadIn({
      from: '2026-11-19',
      to: '2026-11-26',
      workouts: [
        { date: '2026-11-20', durationMin: 50, exercises: [{ sets: [{ reps: 5, weight: 200, type: 'working' }, { reps: 5, weight: 45, type: 'warmup' }] }] },
        { date: '2026-11-10', durationMin: 60, exercises: [{ sets: [{ reps: 5, weight: 200 }] }] } // outside window
      ],
      sports: [
        { date: '2026-11-22', trainingLoad: 400 },
        { date: '2026-11-23', trainingLoad: 350 }
      ],
      weights: [
        { date: '2026-11-19', weight: 166.2 },
        { date: '2026-11-26', weight: 165.0 }
      ],
      foodByDate: { '2026-11-20': 2200, '2026-11-21': 2400 },
      readiness: [
        { date: '2026-11-25', sleep: 4, soreness: 2, mood: 4, energy: 3 },
        { date: '2026-11-18', sleep: 2, soreness: 4, mood: 2, energy: 2 } // outside
      ]
    });
    assert.equal(lead.workouts, 1);
    assert.equal(lead.durationMin, 50);
    assert.equal(lead.volumeLbs, 1000); // warmup excluded
    assert.equal(lead.practiceSessions, 2);
    assert.equal(lead.trainingLoad, 750);
    assert.equal(lead.weightChangeLbs, -1.2);
    assert.equal(lead.foodDays, 2);
    assert.equal(lead.avgCalories, 2300);
    assert.equal(lead.readiness.length, 1);
    assert.equal(lead.readiness[0].sleep, 4);
  });

  it('builds a recap that compares with the last similar event', () => {
    const recap = Recap.buildRecap({
      event: {
        name: 'December 5K', sport: 'Running', type: 'race', date: '2026-12-06',
        result: { kind: 'race', timeSec: 1300, distance: '5K' }
      },
      others: [
        { id: 'prev1', name: 'Thanksgiving 5K', sport: 'Running', type: 'race', date: '2026-11-27', result: { kind: 'race', timeSec: 1360 } }
      ],
      workouts: [],
      sports: [],
      weights: [],
      foodByDate: {},
      readiness: [],
      today: '2026-12-06'
    });
    assert.equal(recap.hasResult, true);
    assert.equal(recap.previous.event.name, 'Thanksgiving 5K');
    assert.equal(recap.previous.timeDeltaSec, -60);
    assert.match(recap.previous.summary, /faster than Thanksgiving 5K/);
    assert.equal(recap.leadIn.from, '2026-11-29');
  });
});
