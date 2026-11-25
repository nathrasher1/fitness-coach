const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const WC = require('../services/weightClass');

describe('weight-class safety', () => {
  const today = '2026-11-25';

  it('caps gradual weekly loss at the smaller of 2 lbs and 1% of body weight', () => {
    assert.equal(WC.safeWeeklyLossLbs(200), 2);
    assert.equal(WC.safeWeeklyLossLbs(150), 1.5);
    assert.equal(WC.safeWeeklyLossLbs(0), null);
  });

  it('treats a 0.5 lb band as on target for adults', () => {
    const p = WC.planWeightClass({
      currentWeightLbs: 165.4, classLbs: 165, weighInDate: '2026-12-10', today, ageGroup: 'adult'
    });
    assert.equal(p.status, 'on_target');
    assert.equal(p.suggestedCalorieDeficit, null);
    assert.equal(p.dailyCutPlan, null);
    assert.equal(p.dehydrationAdvice, null);
    assert.match(p.message, /don't provide crash-cut or dehydration/i);
  });

  it('gives under-class facts without gain or cut advice', () => {
    const p = WC.planWeightClass({
      currentWeightLbs: 160, classLbs: 165, weighInDate: '2026-12-10', today, ageGroup: 'adult'
    });
    assert.equal(p.status, 'under_class');
    assert.match(p.message, /don't suggest gaining or cutting/);
    assert.equal(p.requiredWeeklyLossLbs, null);
  });

  it('is ok when the gap is closable at a gradual pace', () => {
    // 4 lbs in 6 weeks at 180 lbs (cap 1.8 lb/week) is comfortable
    const p = WC.planWeightClass({
      currentWeightLbs: 180, classLbs: 176, weighInDate: '2027-01-06', today, ageGroup: 'adult'
    });
    assert.equal(p.status, 'ok');
    assert.equal(p.safeWeeklyLossLbs, 1.8);
    assert.equal(p.suggestedCalorieDeficit, null);
    assert.equal(p.requiredWeeklyLossLbs, null);
    assert.match(p.message, /gradual pace of at most 1\.8 lbs/);
    assert.match(p.message, /don't provide crash-cut or dehydration/);
  });

  it('warns when the required pace is near the gradual cap', () => {
    // 1.6 lbs in 7 days at 180 lbs (cap 1.8) is 89% of cap
    const p = WC.planWeightClass({
      currentWeightLbs: 180, classLbs: 178.4, weighInDate: '2026-12-02', today, ageGroup: 'adult'
    });
    assert.equal(p.status, 'warning');
    assert.equal(p.reason, 'at_gradual_cap');
    assert.equal(p.dailyCutPlan, null);
    assert.match(p.message, /won't suggest going faster/);
  });

  it('blocks when the gap is too large for the time left', () => {
    // 8 lbs in 7 days at 180 lbs far exceeds 1.8 lb/week
    const p = WC.planWeightClass({
      currentWeightLbs: 180, classLbs: 172, weighInDate: '2026-12-02', today, ageGroup: 'adult'
    });
    assert.equal(p.status, 'blocked');
    assert.equal(p.reason, 'gap_too_large');
    assert.equal(p.canPlan, false);
    assert.equal(p.requiredWeeklyLossLbs, null);
    assert.equal(p.suggestedCalorieDeficit, null);
    assert.match(p.message, /too large to close gradually/);
    assert.match(p.message, /won't suggest a cut/);
    assert.doesNotMatch(p.message, /eat less|deficit|sauna|water cut|spit/i);
  });

  it('blocks same-day or past weigh-ins when still above class', () => {
    const todaySame = WC.planWeightClass({
      currentWeightLbs: 170, classLbs: 165, weighInDate: today, today, ageGroup: 'adult'
    });
    assert.equal(todaySame.status, 'blocked');
    assert.equal(todaySame.reason, 'no_time');
    assert.match(todaySame.message, /last-minute cut/);

    const past = WC.planWeightClass({
      currentWeightLbs: 170, classLbs: 165, weighInDate: '2026-11-20', today, ageGroup: 'adult'
    });
    assert.equal(past.status, 'blocked');
    assert.equal(past.reason, 'no_time');
  });

  it('gives no cutting guidance for teens or children, even with a large gap', () => {
    for (const ageGroup of ['teen', 'child']) {
      const p = WC.planWeightClass({
        currentWeightLbs: 180, classLbs: 150, weighInDate: '2026-12-02', today, ageGroup
      });
      assert.equal(p.status, 'no_guidance');
      assert.equal(p.reason, 'under_18');
      assert.equal(p.canPlan, false);
      assert.equal(p.safeWeeklyLossLbs, null);
      assert.equal(p.requiredWeeklyLossLbs, null);
      assert.equal(p.suggestedCalorieDeficit, null);
      assert.equal(p.message, WC.UNDER_18_MESSAGE);
      assert.doesNotMatch(p.message, /lbs per week|deficit|crash-cut plan to|sauna/i);
    }
  });

  it('gives no cutting guidance when age is unknown', () => {
    const p = WC.planWeightClass({
      currentWeightLbs: 180, classLbs: 170, weighInDate: '2026-12-20', today, ageGroup: null
    });
    assert.equal(p.status, 'no_guidance');
    assert.equal(p.reason, 'age_unknown');
    assert.equal(p.canPlan, false);
  });

  it('asks for a weigh-in when an adult has no current weight', () => {
    const p = WC.planWeightClass({
      classLbs: 165, weighInDate: '2026-12-10', today, ageGroup: 'adult'
    });
    assert.equal(p.status, 'need_weight');
    assert.equal(p.suggestedCalorieDeficit, null);
  });

  it('never emits calorie, deficit, or dehydration advice fields', () => {
    const cases = [
      { currentWeightLbs: 200, classLbs: 165, weighInDate: '2026-11-26', today, ageGroup: 'adult' },
      { currentWeightLbs: 200, classLbs: 198, weighInDate: '2027-02-01', today, ageGroup: 'adult' },
      { currentWeightLbs: 140, classLbs: 132, weighInDate: '2026-12-01', today, ageGroup: 'teen' }
    ];
    cases.forEach((c) => {
      const p = WC.planWeightClass(c);
      assert.equal(p.suggestedCalorieDeficit, null);
      assert.equal(p.dailyCutPlan, null);
      assert.equal(p.dehydrationAdvice, null);
      assert.equal(p.requiredWeeklyLossLbs, null);
      assert.ok(!('kcal' in p) && !('calories' in p));
    });
  });

  it('source does not implement a crash-cut or calorie-deficit planner', () => {
    const src = fs.readFileSync(path.join(__dirname, '../services/weightClass.js'), 'utf8');
    assert.match(src, /never returns a calorie deficit/);
    assert.match(src, /Under-18 users get facts/);
    assert.match(src, /no cutting guidance at all/);
    assert.doesNotMatch(src, /function (crashCut|waterCut|calorieDeficit|saunaPlan)/);
  });
});
