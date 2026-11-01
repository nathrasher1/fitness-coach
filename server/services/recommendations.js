const { isDateKey, shiftKey } = require('./dates');
const Weight = require('../models/Weight');
const CalorieLog = require('../models/CalorieLog');
const FoodLog = require('../models/FoodLog');
const Goal = require('../models/Goal');
const Settings = require('../models/Settings');
const User = require('../models/User');
const AboutYou = require('../models/AboutYou');
const { userGroup, ageOn } = require('./age');
const AY = require('../../client/lib/aboutYou');

function daysBetween(d1, d2) {
  const a = new Date(d1 + 'T12:00:00');
  const b = new Date(d2 + 'T12:00:00');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Macro targets based on goal type and average bodyweight.
 *
 * Lose:    Protein 1.0 g/lb, Fat 0.3 g/lb, Carbs = remainder
 * Gain:    Protein 0.9 g/lb, Fat 0.3 g/lb, Carbs = remainder
 * Maintain:Protein 0.9 g/lb, Fat 0.3 g/lb, Carbs = remainder
 *
 * Later: refine with body-fat % and combined goals.
 */
function computeMacros(targetDaily, avgWeightLbs, goalType) {
  let proteinPerLb = 0.9;
  if (goalType === 'lose') proteinPerLb = 1.0;
  else if (goalType === 'gain') proteinPerLb = 0.9;

  const fatPerLb = 0.3;

  let proteinG = Math.round(avgWeightLbs * proteinPerLb);
  let fatG = Math.round(avgWeightLbs * fatPerLb);

  const minCalsForMacros = proteinG * 4 + fatG * 9;
  if (minCalsForMacros > targetDaily * 0.95) {
    const room = Math.max(0, targetDaily * 0.9);
    fatG = Math.max(20, Math.round((room - proteinG * 4) / 9));
    if (proteinG * 4 + fatG * 9 > targetDaily) {
      proteinG = Math.max(80, Math.round((targetDaily * 0.4) / 4));
      fatG = Math.max(20, Math.round((targetDaily * 0.25) / 9));
    }
  }

  const carbsG = Math.max(0, Math.round((targetDaily - proteinG * 4 - fatG * 9) / 4));

  return { proteinG, carbsG, fatG, proteinPerLb, fatPerLb };
}

/**
 * What calorie guidance an age group gets. One place to extend later (for example a
 * clinician-guided option for some teens): today teens get no deficit, no formula target, no BMI.
 */
function targetPolicy(group) {
  if (group === 'adult') return { allowDeficit: true, allowFormula: true, showBmi: true };
  if (group === 'teen') return { allowDeficit: false, allowFormula: false, showBmi: false };
  return { allowDeficit: false, allowFormula: false, showBmi: false }; // child/unknown: most conservative
}

// "Enough logs" rule for a number based on you: in the 7 days ending today (today + 6 before it),
// food logged on at least 5 different days AND at least 2 weigh-ins.
const SUFFICIENT = { windowDays: 7, foodDays: 5, weighIns: 2 };
function sufficiency(foodDates, weightDates, todayKey) {
  const from = shiftKey(todayKey, -(SUFFICIENT.windowDays - 1));
  const inWin = (d) => d >= from && d <= todayKey;
  const foodDays = new Set(foodDates.filter(inWin)).size;
  const weighIns = new Set(weightDates.filter(inWin)).size;
  return { ...SUFFICIENT, from, to: todayKey, loggedFoodDays: foodDays, loggedWeighIns: weighIns, ok: foodDays >= SUFFICIENT.foodDays && weighIns >= SUFFICIENT.weighIns };
}

async function computeCalorieRecommendation(userId, today) {
  const todayKey = isDateKey(today) ? today : new Date().toISOString().slice(0, 10);
  const settings = (await Settings.findOne({ user: userId })) || { calAvgDays: 14 };
  const avgDays = settings.calAvgDays || 14;
  const cutoffStr = shiftKey(todayKey, -Math.max(avgDays, 14));

  const [weights, foodLogs, calLogs, user, about, latestWeight, goal] = await Promise.all([
    Weight.find({ user: userId, date: { $gte: cutoffStr, $lte: todayKey } }).sort({ date: 1 }),
    FoodLog.find({ user: userId, date: { $gte: cutoffStr, $lte: todayKey } }),
    CalorieLog.find({ user: userId, date: { $gte: cutoffStr, $lte: todayKey } }),
    User.findById(userId).select('+dob accountLocked heightCm'),
    AboutYou.findOne({ user: userId }).lean(),
    Weight.findOne({ user: userId, date: { $lte: todayKey } }).sort({ date: -1 }),
    Goal.findOne({ user: userId })
  ]);
  const group = userGroup(user, todayKey);
  const policy = targetPolicy(group);
  const suff = sufficiency([...foodLogs.map((l) => l.date), ...calLogs.map((l) => l.date)], weights.map((w) => w.date), todayKey);

  // 1) From your logs: average intake corrected by the weight trend (needs 3+ logged days + 2 weigh-ins).
  let fromLogs = null;
  let avgCalories = null;
  let calorieSampleSize = 0;
  if (foodLogs.length >= 3) {
    const byDate = {};
    foodLogs.forEach((l) => { byDate[l.date] = (byDate[l.date] || 0) + l.calories; });
    const dailyTotals = Object.values(byDate);
    avgCalories = dailyTotals.reduce((a, v) => a + v, 0) / dailyTotals.length;
    calorieSampleSize = dailyTotals.length;
  } else if (calLogs.length >= 3) {
    avgCalories = calLogs.reduce((a, l) => a + l.calories, 0) / calLogs.length;
    calorieSampleSize = calLogs.length;
  }
  if (weights.length >= 2 && avgCalories != null) {
    const first = weights[0];
    const last = weights[weights.length - 1];
    const spanDays = Math.max(1, daysBetween(first.date, last.date));
    const deltaLbs = last.weight - first.weight;
    const dailySurplus = (deltaLbs * 3500) / spanDays;
    fromLogs = {
      maintenance: avgCalories - dailySurplus, first, last, spanDays, deltaLbs, dailySurplus,
      avgWeightLbs: weights.reduce((a, w) => a + w.weight, 0) / weights.length
    };
  }

  // 2) Starting estimate from body stats (adults only): Mifflin-St Jeor x everyday activity.
  let fromFormula = null;
  if (policy.allowFormula && latestWeight && user && user.dob) {
    const heightCm = (about && about.heightCm) || user.heightCm;
    const est = AY.estimateMaintenance({ weightLbs: latestWeight.weight, heightCm, age: ageOn(user.dob, todayKey), sex: (about && about.sex) || 'unspecified', activity: about && about.activity });
    if (est) fromFormula = { ...est, weightLbs: latestWeight.weight, heightCm, sex: (about && about.sex) || 'unspecified' };
  }

  // Enough recent logs -> your own data. Otherwise prefer the body-stats estimate; fall back to sparse logs.
  let basis = null;
  if (suff.ok && fromLogs) basis = 'logs';
  else if (fromFormula) basis = 'formula';
  else if (fromLogs) basis = 'logs';

  if (!basis) {
    const needs = [];
    if (weights.length < 2) needs.push('at least 2 weigh-ins');
    if (avgCalories == null) needs.push('a few days of food logs');
    let reason = `Need ${needs.join(' and ') || 'more logs'} in the last two weeks.`;
    if (policy.allowFormula && !fromFormula) reason += ' Or add your height (Settings → About you) and a weigh-in for a starting estimate.';
    return { ready: false, reason, group, policy, sufficiency: suff };
  }

  const estimatedMaintenance = basis === 'logs' ? fromLogs.maintenance : fromFormula.maintenance;
  const currentWeight = basis === 'logs' ? fromLogs.last.weight : fromFormula.weightLbs;
  const avgWeightLbs = basis === 'logs' ? fromLogs.avgWeightLbs : fromFormula.weightLbs;

  let targetDaily = estimatedMaintenance;
  let goalNote = 'Maintain current weight';
  let ratePerWeek = 0;
  let goalType = 'maintain';
  let limitNote = '';

  if (goal && goal.type !== 'maintain') {
    goalType = goal.type;
    if (goalType === 'lose' && !policy.allowDeficit) {
      goalType = 'maintain';
      limitNote = 'For members under 18 the app suggests fuel for growth and training, not a calorie deficit.';
    } else if (!goal.amountLbs) {
      goalNote = `Add how many lbs to ${goal.type} on Goals to set a pace. Showing maintenance for now.`;
    } else {
      const amount = goal.amountLbs || 0;
      const start = goal.startWeight || (fromLogs ? fromLogs.first.weight : currentWeight);
      const targetWeight = goal.type === 'lose' ? start - amount : start + amount;
      const remainingLbs = goal.type === 'lose' ? Math.max(0, currentWeight - targetWeight) : Math.max(0, targetWeight - currentWeight);
      const daysLeft = goal.targetDate ? Math.max(1, daysBetween(todayKey, goal.targetDate)) : null;
      const weeksLeft = daysLeft ? daysLeft / 7 : Math.max(1, goal.weeks || 12);
      ratePerWeek = remainingLbs / weeksLeft;
      targetDaily = estimatedMaintenance + ((goal.type === 'lose' ? -ratePerWeek : ratePerWeek) * 3500) / 7;
      const by = goal.targetDate ? ' by ' + goal.targetDate : '';
      goalNote = `${remainingLbs.toFixed(1)} lbs left${by} (~${ratePerWeek.toFixed(2)} lbs/week)`;
    }
  }

  targetDaily = Math.max(1200, Math.round(targetDaily));
  const macros = computeMacros(targetDaily, avgWeightLbs, goalType);

  return {
    ready: true,
    basis,
    estimate: !suff.ok, // show the "this is only an estimate" notice
    sufficiency: suff,
    group,
    policy,
    limitNote,
    targetDaily,
    estimatedMaintenance: Math.round(estimatedMaintenance),
    avgCalories: avgCalories == null ? null : Math.round(avgCalories),
    avgWeightLbs: Math.round(avgWeightLbs * 10) / 10,
    weightDelta: fromLogs ? fromLogs.deltaLbs : 0,
    spanDays: fromLogs ? fromLogs.spanDays : 0,
    dailySurplus: fromLogs ? Math.round(fromLogs.dailySurplus) : 0,
    formula: basis === 'formula' ? { bmr: fromFormula.bmr, multiplier: fromFormula.multiplier, assumedActivity: fromFormula.assumedActivity, sex: fromFormula.sex } : null,
    goalNote,
    goalType,
    ratePerWeek,
    macros,
    sampleSize: { weights: weights.length, calorieDays: calorieSampleSize }
  };
}

module.exports = { computeCalorieRecommendation, computeMacros, targetPolicy, sufficiency, SUFFICIENT };
