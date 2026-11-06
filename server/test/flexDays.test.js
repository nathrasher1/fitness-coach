const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const FD = require('../services/flexDays');

describe('flexDays', () => {
  it('computes Thanksgiving 2026 as Nov 26', () => {
    assert.equal(FD.thanksgiving(2026), '2026-11-26');
  });

  it('lists holiday presets including Christmas', () => {
    const h = FD.holidayPresets(2026);
    assert.ok(h.some((x) => x.key === 'christmas' && x.date === '2026-12-25'));
    assert.ok(h.some((x) => x.key === 'thanksgiving'));
  });

  it('caps monthly flex days', () => {
    assert.deepEqual(FD.canAddFlex({ existingCount: 4, cap: 4, alreadyMarked: false }), {
      ok: false,
      reason: "You've used your 4 flex days for this month"
    });
    assert.equal(FD.canAddFlex({ existingCount: 4, cap: 4, alreadyMarked: true }).ok, true);
    assert.equal(FD.canAddFlex({ existingCount: 3, cap: 4, alreadyMarked: false }).ok, true);
  });

  it('normalizes estimate presets and custom addKcal', () => {
    assert.deepEqual(FD.normalizeEstimate({ estimate: 'feast' }), {
      estimate: 'feast', addKcal: 2000, label: 'Feast'
    });
    assert.equal(FD.normalizeEstimate({ estimate: 'light', addKcal: 750 }).addKcal, 750);
    assert.equal(FD.normalizeEstimate({ estimate: 'none' }).addKcal, 0);
  });

  it('excludes flex days from sufficiency without firing estimate caveat', () => {
    // 4 food days + 1 flex day in window → effective 5; 2 weigh-ins → ok
    const food = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];
    const weights = ['2026-11-01', '2026-11-05'];
    const flex = new Set(['2026-11-05']);
    const s = FD.sufficiencyExcludingFlex(food, weights, '2026-11-06', flex, {
      windowDays: 7, foodDays: 5, weighIns: 2
    });
    assert.equal(s.ok, true);
    assert.equal(s.loggedFoodDays, 4);
    assert.equal(s.flexDaysInWindow, 1);
    assert.equal(s.effectiveFoodDays, 5);
  });

  it('excludeFlexFromDates drops flex keys', () => {
    assert.deepEqual(
      FD.excludeFlexFromDates(['2026-11-01', '2026-11-26', '2026-11-02'], new Set(['2026-11-26'])),
      ['2026-11-01', '2026-11-02']
    );
  });

  it('buffer plan is adult-only and splits ~25%', () => {
    assert.deepEqual(FD.bufferPlan('2026-11-26', 2000, { adult: false }), []);
    const plan = FD.bufferPlan('2026-11-26', 2000, { adult: true });
    assert.equal(plan.length, 2);
    assert.equal(plan[0].date, '2026-11-25');
    assert.equal(plan[1].date, '2026-11-27');
    assert.equal(plan[0].addKcal, 250); // 25% of 2000 / 2
  });
});
