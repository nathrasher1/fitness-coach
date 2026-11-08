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

  it('counts a flex day as soft food data so the insufficient-logs caveat does not fire', () => {
    const food = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];
    const s = FD.sufficiencyWithFlex(food, ['2026-11-01', '2026-11-05'], '2026-11-06', new Set(['2026-11-05']), { windowDays: 7, foodDays: 5, weighIns: 2 });
    assert.equal(s.ok, true);
    assert.equal(s.loggedFoodDays, 4);
    assert.equal(s.flexDaysInWindow, 1);
    assert.equal(s.effectiveFoodDays, 5);
  });

  it('down-weights soft (flex) days in the weighted average but still counts them', () => {
    const hard = [2000, 2000, 2000].map((kcal) => ({ kcal, soft: false }));
    const withFlex = FD.weightedAverage([...hard, { kcal: 5000, soft: true }]);
    // (6000 + 0.5*5000) / 3.5 ≈ 2428.6 — higher than 2000, lower than the unweighted 2750
    assert.ok(Math.abs(withFlex - 8500 / 3.5) < 0.01);
    assert.ok(withFlex > 2000 && withFlex < 2750);
    assert.equal(FD.weightedAverage([]), null);
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
