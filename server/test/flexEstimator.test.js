const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../services/flexEstimator');

// Build N days of logs: breakfast/lunch/dinner with a dinner of `dinner` kcal.
function history(days, dinner = 900, extra = []) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
    out.push({ date, meal: 'breakfast', calories: 400, foodName: 'Oats' });
    out.push({ date, meal: 'lunch', calories: 600, foodName: 'Sandwich' });
    out.push({ date, meal: 'dinner', calories: dinner, foodName: 'Chicken' });
  }
  return out.concat(extra);
}

describe('flexEstimator constants', () => {
  it('has monotonic fullness and plates factors', () => {
    const f = E.FULLNESS;
    assert.ok(f.light < f.comfortable && f.comfortable < f.full && f.full < f.stuffed);
    assert.ok(E.PLATES[1] < E.PLATES[2] && E.PLATES[2] < E.PLATES[3]);
    assert.equal(E.CORRECTION_MIN, 0.7);
    assert.equal(E.CORRECTION_MAX, 1.4);
  });

  it('includes the core holiday menu', () => {
    const keys = E.HOLIDAY_MENU.map((m) => m.key);
    for (const k of ['turkey', 'ham', 'stuffing', 'mashed_potatoes', 'gravy', 'rolls', 'mac_cheese', 'green_bean_casserole', 'sweet_potato_casserole', 'cranberry_sauce', 'pie', 'cookies', 'wine', 'beer']) assert.ok(keys.includes(k), k);
  });
});

describe('percentile', () => {
  it('interpolates', () => {
    assert.equal(E.percentile([1, 2, 3, 4, 5], 0.5), 3);
    assert.equal(E.percentile([0, 10], 0.85), 10); // non-positive values are ignored
    assert.equal(E.percentile([], 0.5), null);
  });
});

describe('computeBaseline', () => {
  it('falls back to population defaults with thin history', () => {
    const b = E.computeBaseline(history(2));
    assert.equal(b.history, 'thin');
    assert.equal(b.source, 'population');
    assert.equal(b.bigMeal, E.POP.bigMeal);
  });

  it('uses minor population defaults for teens', () => {
    assert.equal(E.computeBaseline([], { minor: true }).bigMeal, E.POP.minor.bigMeal);
  });

  it('is personal with rich history (85th percentile meal)', () => {
    const b = E.computeBaseline(history(20, 900));
    assert.equal(b.history, 'rich');
    assert.equal(b.source, 'personal');
    assert.equal(b.bigMeal, 900); // dinners dominate the top 15%
    assert.equal(b.daily, 1900);
  });

  it('blends with medium history', () => {
    const b = E.computeBaseline(history(7, 900));
    assert.equal(b.source, 'blended');
    assert.equal(b.bigMeal, Math.round(0.6 * 900 + 0.4 * E.POP.bigMeal));
  });

  it('excludes other flex days and learns usual gram portions', () => {
    const extra = [
      { date: '2026-10-01', meal: 'dinner', calories: 300, foodName: 'Mashed potatoes', amount: 250, amountUnit: 'g' },
      { date: '2026-10-02', meal: 'dinner', calories: 300, foodName: 'Mashed potatoes', amount: 270, amountUnit: 'g' },
      { date: '2026-10-30', meal: 'dinner', calories: 9000, foodName: 'Feast' }
    ];
    const b = E.computeBaseline(history(20, 900, extra), { excludeDates: ['2026-10-30'] });
    assert.equal(b.portions['mashed potatoes'], 260);
    assert.ok(b.bigMeal < 2000);
  });
});

describe('estimate', () => {
  const baseline = { bigMeal: 1000, daily: 2000, history: 'rich', source: 'personal', portions: {} };

  it('total = big meal × fullness × plates for plate foods', () => {
    const r = E.estimate({ baseline, foods: [{ key: 'turkey' }, { key: 'stuffing' }], fullness: 'full', plates: 2 });
    const expected = 1000 * E.FULLNESS.full * E.PLATES[2];
    assert.ok(Math.abs(r.kcal - expected) <= 2, `${r.kcal} vs ${expected}`);
    assert.equal(r.items.length, 2);
  });

  it('range is ±20% with rich history and wider when thin', () => {
    const rich = E.estimate({ baseline, foods: [{ key: 'turkey' }] });
    assert.equal(rich.spread, 0.2);
    assert.equal(rich.low, Math.round(rich.kcal * 0.8));
    assert.equal(rich.high, Math.round(rich.kcal * 1.2));
    assert.equal(rich.confidence, 'medium');
    const thin = E.estimate({ baseline: { ...baseline, history: 'thin' }, foods: [{ key: 'turkey' }] });
    assert.equal(thin.spread, 0.35);
    assert.equal(thin.confidence, 'low');
    assert.match(thin.label, /^Estimate ≈/);
  });

  it('nudges shift share between foods without changing the plate total', () => {
    const a = E.estimate({ baseline, foods: [{ key: 'turkey' }, { key: 'stuffing' }] });
    const b = E.estimate({ baseline, foods: [{ key: 'turkey' }, { key: 'stuffing', nudge: 'lot' }] });
    assert.ok(Math.abs(a.kcal - b.kcal) <= 2);
    const st = (r) => r.items.find((i) => i.key === 'stuffing').kcal;
    assert.ok(st(b) > st(a));
  });

  it('anchors a food to the user usual portion when known', () => {
    const withPortion = { ...baseline, portions: { 'mashed potatoes': 400 } };
    const a = E.estimate({ baseline, foods: [{ key: 'turkey' }, { key: 'mashed_potatoes' }] });
    const b = E.estimate({ baseline: withPortion, foods: [{ key: 'turkey' }, { key: 'mashed_potatoes' }] });
    const mp = (r) => r.items.find((i) => i.key === 'mashed_potatoes').kcal;
    assert.ok(mp(b) > mp(a));
  });

  it('adds drinks per serving and desserts per serving', () => {
    const r = E.estimate({ baseline, foods: [{ key: 'turkey' }, { key: 'wine', nudge: 'lot' }, { key: 'pie' }], dessertServings: 2 });
    const wine = r.items.find((i) => i.key === 'wine');
    assert.equal(wine.kcal, Math.round(150 * 0.83 * 1.5));
    assert.equal(r.items.find((i) => i.key === 'pie').kcal, 2 * E.DESSERT_KCAL);
  });

  it('applies a bounded correction factor', () => {
    const base = E.estimate({ baseline, foods: [{ key: 'turkey' }] }).kcal;
    const hi = E.estimate({ baseline, foods: [{ key: 'turkey' }], correction: 5 });
    assert.equal(hi.correction, 1.4);
    assert.ok(Math.abs(hi.kcal - base * 1.4) <= 2);
  });

  it('supports custom database foods with a density', () => {
    const r = E.estimate({ baseline, foods: [{ label: 'Tamales', kcalPerG: 2.2, foodId: 'abc' }] });
    assert.equal(r.items[0].label, 'Tamales');
    assert.equal(r.items[0].grams, Math.round(r.items[0].kcal / 2.2));
  });
});

describe('calibrate', () => {
  it('does nothing without enough weigh-ins', () => {
    assert.deepEqual(E.calibrate({ predictedSurplus: 2000, observedDeltaLbs: 1, previous: 1, weighIns: 2 }), { factor: 1, applied: false });
  });

  it('moves toward observed/predicted and stays within 0.7–1.4', () => {
    // observed 1.6 lb × 3500 × 0.5 = 2800 vs predicted 2000 → ratio 1.4; smoothed with 1 → 1.2
    const up = E.calibrate({ predictedSurplus: 2000, observedDeltaLbs: 1.6, previous: 1, weighIns: 4 });
    assert.equal(up.applied, true);
    assert.equal(up.factor, 1.2);
    const down = E.calibrate({ predictedSurplus: 2000, observedDeltaLbs: -3, previous: 0.7, weighIns: 5 });
    assert.equal(down.factor, 0.7);
  });
});

describe('trendDelta', () => {
  it('needs 3 weigh-ins 3–7 days after', () => {
    const w = [{ date: '2026-11-20', weight: 180 }, { date: '2026-11-29', weight: 181 }];
    assert.equal(E.trendDelta(w, '2026-11-26'), null);
  });

  it('measures change net of the prior trend', () => {
    const w = [
      { date: '2026-11-20', weight: 180 }, { date: '2026-11-25', weight: 180 },
      { date: '2026-11-29', weight: 181 }, { date: '2026-11-30', weight: 181 }, { date: '2026-12-01', weight: 181 }
    ];
    const r = E.trendDelta(w, '2026-11-26');
    assert.equal(r.weighIns, 3);
    assert.equal(r.deltaLbs, 1);
  });
});
