const { isDateKey, shiftKey } = require('./dates');
const Weight = require('../models/Weight');
const CalorieLog = require('../models/CalorieLog');
const FoodLog = require('../models/FoodLog');
const Goal = require('../models/Goal');
const Settings = require('../models/Settings');

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

async function computeCalorieRecommendation(userId, today) {
  const todayKey = isDateKey(today) ? today : new Date().toISOString().slice(0, 10);
  const settings = (await Settings.findOne({ user: userId })) || { calAvgDays: 14 };
  const avgDays = settings.calAvgDays || 14;

  const cutoffStr = shiftKey(todayKey, -Math.max(avgDays, 14));

  const weights = await Weight.find({
    user: userId,
    date: { $gte: cutoffStr }
  }).sort({ date: 1 });

  const foodLogs = await FoodLog.find({
    user: userId,
    date: { $gte: cutoffStr }
  });

  let avgCalories = null;
  let calorieSampleSize = 0;

  if (foodLogs.length >= 3) {
    const byDate = {};
    foodLogs.forEach((l) => {
      byDate[l.date] = (byDate[l.date] || 0) + l.calories;
    });
    const dailyTotals = Object.values(byDate);
    avgCalories = dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length;
    calorieSampleSize = dailyTotals.length;
  } else {
    const calLogs = await CalorieLog.find({
      user: userId,
      date: { $gte: cutoffStr }
    });
    if (calLogs.length >= 3) {
      avgCalories = calLogs.reduce((s, l) => s + l.calories, 0) / calLogs.length;
      calorieSampleSize = calLogs.length;
    }
  }

  if (weights.length < 2 || avgCalories == null) {
    return {
      ready: false,
      reason:
        weights.length < 2
          ? 'Need at least 2 weight entries in the recent window.'
          : 'Need several days of calorie or food logs to estimate maintenance.'
    };
  }

  const first = weights[0];
  const last = weights[weights.length - 1];
  const spanDays = Math.max(1, daysBetween(first.date, last.date));
  const deltaLbs = last.weight - first.weight;
  const dailySurplus = (deltaLbs * 3500) / spanDays;
  const estimatedMaintenance = avgCalories - dailySurplus;

  const avgWeightLbs = weights.reduce((s, w) => s + w.weight, 0) / weights.length;

  const goal = await Goal.findOne({ user: userId });
  let targetDaily = estimatedMaintenance;
  let goalNote = 'Maintain current weight';
  let ratePerWeek = 0;
  let goalType = 'maintain';

  if (goal && goal.type !== 'maintain') {
    goalType = goal.type;
    const amount = goal.amountLbs || 0;
    const start = goal.startWeight || first.weight;
    const targetWeight = goal.type === 'lose' ? start - amount : start + amount;
    const remainingLbs = goal.type === 'lose'
      ? Math.max(0, last.weight - targetWeight)
      : Math.max(0, targetWeight - last.weight);

    let daysLeft = null;
    if (goal.targetDate) {
      daysLeft = Math.max(1, daysBetween(todayKey, goal.targetDate));
    }
    const weeksLeft = daysLeft ? daysLeft / 7 : Math.max(1, goal.weeks || 12);
    ratePerWeek = remainingLbs / weeksLeft;
    const desiredDailySurplus =
      (goal.type === 'lose' ? -ratePerWeek : ratePerWeek) * 3500 / 7;
    targetDaily = estimatedMaintenance + desiredDailySurplus;
    const by = goal.targetDate ? ' by ' + goal.targetDate : '';
    goalNote =
      goal.type === 'lose'
        ? `${remainingLbs.toFixed(1)} lbs left${by} (~${ratePerWeek.toFixed(2)} lbs/week)`
        : `${remainingLbs.toFixed(1)} lbs left${by} (~${ratePerWeek.toFixed(2)} lbs/week)`;
  }

  targetDaily = Math.max(1200, Math.round(targetDaily));
  const macros = computeMacros(targetDaily, avgWeightLbs, goalType);

  return {
    ready: true,
    targetDaily,
    estimatedMaintenance: Math.round(estimatedMaintenance),
    avgCalories: Math.round(avgCalories),
    avgWeightLbs: Math.round(avgWeightLbs * 10) / 10,
    weightDelta: deltaLbs,
    spanDays,
    dailySurplus: Math.round(dailySurplus),
    goalNote,
    goalType,
    ratePerWeek,
    macros,
    sampleSize: { weights: weights.length, calorieDays: calorieSampleSize }
  };
}

module.exports = { computeCalorieRecommendation, computeMacros };
