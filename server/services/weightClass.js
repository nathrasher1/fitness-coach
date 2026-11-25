// Weight-class planning with hard safety guardrails.
//
// This module never returns a calorie deficit, a daily cut plan, or advice to
// dehydrate, water-cut, sit in a sauna, or crash cut. Under-18 users get facts
// only — no cutting guidance at all. When the gap is too large for the time
// left at a gradual pace, planning is blocked.

const { isDateKey } = require('./dates');

const BAND_LBS = 0.5; // within this of the class counts as on target
const SAFE_WEEKLY_LOSS_PCT = 0.01; // 1% of current body weight per week
const SAFE_WEEKLY_LOSS_LBS_CAP = 2; // never treat more than 2 lb/week as gradual
const WARN_FRACTION = 0.8; // at or above 80% of the gradual cap → warning

const NO_CRASH_LINE = "We don't provide crash-cut or dehydration plans.";
const UNDER_18_MESSAGE = "We don't provide weight-class cutting guidance for members under 18. Talk with a parent or guardian and a doctor before changing how you eat or train for a weight class.";

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function daysBetween(fromKey, toKey) {
  if (!isDateKey(fromKey) || !isDateKey(toKey)) return null;
  const a = new Date(fromKey + 'T00:00:00Z');
  const b = new Date(toKey + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

/** Gradual weekly loss cap in lbs: the smaller of 2 lbs and 1% of current weight. */
function safeWeeklyLossLbs(currentWeightLbs) {
  const w = Number(currentWeightLbs);
  if (!(w > 0)) return null;
  return Math.min(SAFE_WEEKLY_LOSS_LBS_CAP, round1(w * SAFE_WEEKLY_LOSS_PCT));
}

function emptyAdvice() {
  // Explicitly no cut plan, no calories, no rate to "hit."
  return {
    requiredWeeklyLossLbs: null,
    suggestedCalorieDeficit: null,
    dailyCutPlan: null,
    dehydrationAdvice: null
  };
}

function facts(current, cls, weighInDate, today) {
  const weigh = isDateKey(weighInDate) ? weighInDate : today;
  return {
    currentWeightLbs: round1(current),
    classLbs: round1(cls),
    gapLbs: round1(current - cls),
    weighInDate: weigh,
    daysUntilWeighIn: daysBetween(today, weigh)
  };
}

/**
 * Plan (or refuse to plan) a weight-class target.
 * ageGroup: 'adult' | 'teen' | 'child' | null
 */
function planWeightClass({ currentWeightLbs, classLbs, weighInDate, today, ageGroup }) {
  const current = Number(currentWeightLbs);
  const cls = Number(classLbs);
  if (!(cls > 0 && cls <= 800)) {
    return { ok: false, error: 'Enter a weight class between 0 and 800 lbs.' };
  }
  if (!isDateKey(today)) {
    return { ok: false, error: 'Need a valid today date.' };
  }

  if (ageGroup !== 'adult') {
    const f = Number.isFinite(current) && current > 0
      ? facts(current, cls, weighInDate, today)
      : { classLbs: round1(cls), currentWeightLbs: null, gapLbs: null, weighInDate: isDateKey(weighInDate) ? weighInDate : today, daysUntilWeighIn: daysBetween(today, isDateKey(weighInDate) ? weighInDate : today) };
    return {
      ok: true,
      status: 'no_guidance',
      reason: (ageGroup === 'teen' || ageGroup === 'child') ? 'under_18' : 'age_unknown',
      canPlan: false,
      message: UNDER_18_MESSAGE,
      safeWeeklyLossLbs: null,
      ...f,
      ...emptyAdvice()
    };
  }

  if (!(current > 0)) {
    return {
      ok: true,
      status: 'need_weight',
      reason: 'need_weight',
      canPlan: false,
      message: 'Log a weigh-in to compare with this class. ' + NO_CRASH_LINE,
      currentWeightLbs: null,
      classLbs: round1(cls),
      gapLbs: null,
      weighInDate: isDateKey(weighInDate) ? weighInDate : today,
      daysUntilWeighIn: daysBetween(today, isDateKey(weighInDate) ? weighInDate : today),
      safeWeeklyLossLbs: null,
      ...emptyAdvice()
    };
  }

  const f = facts(current, cls, weighInDate, today);
  const safeWeekly = safeWeeklyLossLbs(current);

  if (current <= cls + BAND_LBS) {
    const under = current < cls - BAND_LBS;
    return {
      ok: true,
      status: under ? 'under_class' : 'on_target',
      reason: under ? 'under_class' : 'on_target',
      canPlan: false,
      message: under
        ? `You're below the ${round1(cls)} lb class, based on your latest weigh-in. That's just a fact — we don't suggest gaining or cutting to make a class.`
        : `You're at or within ${BAND_LBS} lb of the ${round1(cls)} lb class. ${NO_CRASH_LINE}`,
      safeWeeklyLossLbs: safeWeekly,
      ...f,
      ...emptyAdvice()
    };
  }

  const gap = current - cls;
  const days = f.daysUntilWeighIn;
  const weeksLeft = days != null && days > 0 ? days / 7 : 0;
  const requiredWeekly = weeksLeft > 0 ? gap / weeksLeft : Infinity;
  const tooLarge = days == null || days <= 0 || requiredWeekly > safeWeekly;

  if (tooLarge) {
    const noTime = days == null || days <= 0;
    return {
      ok: true,
      status: 'blocked',
      reason: noTime ? 'no_time' : 'gap_too_large',
      canPlan: false,
      message: noTime
        ? `There's still a gap to the class, and the weigh-in is today or has passed. We won't suggest a last-minute cut. ${NO_CRASH_LINE}`
        : `The gap is too large to close gradually before the weigh-in. We won't suggest a cut. Consider a different class, or more time. ${NO_CRASH_LINE}`,
      safeWeeklyLossLbs: safeWeekly,
      ...f,
      ...emptyAdvice()
    };
  }

  const atCap = requiredWeekly >= safeWeekly * WARN_FRACTION;
  return {
    ok: true,
    status: atCap ? 'warning' : 'ok',
    reason: atCap ? 'at_gradual_cap' : 'gradual',
    canPlan: false, // we still never emit a cut plan; this is status only
    message: atCap
      ? `Closing this gap would take a gradual pace at the upper end of about ${safeWeekly} lbs per week. We won't suggest going faster. ${NO_CRASH_LINE}`
      : `This gap can be closed at a gradual pace of at most ${safeWeekly} lbs per week. ${NO_CRASH_LINE}`,
    safeWeeklyLossLbs: safeWeekly,
    ...f,
    ...emptyAdvice()
  };
}

module.exports = {
  BAND_LBS,
  SAFE_WEEKLY_LOSS_PCT,
  SAFE_WEEKLY_LOSS_LBS_CAP,
  NO_CRASH_LINE,
  UNDER_18_MESSAGE,
  daysBetween,
  safeWeeklyLossLbs,
  planWeightClass
};
