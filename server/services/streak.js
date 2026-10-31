// Rest-day-friendly streaks.
//
// The streak counts training days completed in a row. Days off don't break it when:
//   * they are planned rest: a weekday not in your training days, or (with no
//     weekdays chosen) one of your N planned rest days that week, or
//   * you tapped "Take a rest day" on a training day (up to your weekly allowance).
// Any other missed training day breaks it. Today never breaks it (it's in progress).
// Workouts on rest days still count. Weeks run Monday to Sunday, in the user's
// local calendar (date keys from services/dates).
const WorkoutLog = require('../models/WorkoutLog');
const RestDay = require('../models/RestDay');
const Settings = require('../models/Settings');
const { shiftKey } = require('./dates');

const LOOKBACK = 400;
const DEFAULT_REST = 3;

const weekday = (key) => new Date(key + 'T00:00:00Z').getUTCDay(); // 0 Sun .. 6 Sat
const weekStart = (key) => shiftKey(key, -((weekday(key) + 6) % 7)); // Monday

function programs() {
  try { return require('../routes/workouts').PROGRAMS || []; } catch { return []; }
}

// The schedule the streak uses, from Settings (+ the program of your latest plan workout).
function resolveSchedule(settings, recentPlanDay) {
  const days = [...new Set(((settings && settings.trainingDays) || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const skips = settings && Number.isInteger(settings.restSkipsPerWeek) ? Math.max(0, Math.min(2, settings.restSkipsPerWeek)) : 1;
  if (days.length) return { mode: 'weekdays', days, skips, source: 'weekdays' };
  if (settings && Number.isInteger(settings.restDaysPerWeek)) return { mode: 'flex', rest: settings.restDaysPerWeek, skips, source: 'setting' };
  const pid = String(recentPlanDay || '').split(':')[0];
  const prog = pid && !pid.startsWith('routine') && programs().find((p) => p.id === pid);
  if (prog && prog.days && prog.days.length) {
    return { mode: 'flex', rest: Math.max(0, Math.min(6, 7 - prog.days.length)), skips, source: 'program', program: prog.name };
  }
  return { mode: 'flex', rest: DEFAULT_REST, skips, source: 'default' };
}

// Pure calculation. workouts / rests: Set of date keys. Returns the streak and this week's status.
function computeStreak({ workouts, rests, today, schedule }) {
  const s = schedule;
  const isPlannedRestWeekday = (k) => s.mode === 'weekdays' && !s.days.includes(weekday(k));
  const weeks = new Map(); // weekStart -> { rest, skips }
  const wk = (k) => { const w = weekStart(k); if (!weeks.has(w)) weeks.set(w, { rest: 0, skips: 0 }); return weeks.get(w); };

  let streak = 0;
  const todayDone = workouts.has(today);
  if (todayDone) streak = 1;
  let brokeOn = null;
  for (let i = 1; i <= LOOKBACK; i++) {
    const d = shiftKey(today, -i);
    if (workouts.has(d)) { streak++; continue; }
    if (isPlannedRestWeekday(d)) continue;
    const w = wk(d);
    // A tapped rest day uses the weekly skip allowance first, saving planned rest for untapped days.
    if (rests.has(d) && w.skips < s.skips) { w.skips++; continue; }
    if (s.mode === 'flex' && w.rest < s.rest) { w.rest++; continue; }
    brokeOn = d;
    break;
  }

  // This week so far (before today), for the button and the hint.
  const thisWeek = weekStart(today);
  let restUsed = 0, skipsUsed = 0;
  for (let d = thisWeek; d < today; d = shiftKey(d, 1)) {
    if (workouts.has(d) || isPlannedRestWeekday(d)) continue;
    if (rests.has(d) && skipsUsed < s.skips) { skipsUsed++; continue; }
    if (s.mode === 'flex' && restUsed < s.rest) restUsed++;
  }
  const todayTaken = rests.has(today);
  const plannedRestToday = s.mode === 'weekdays' ? isPlannedRestWeekday(today) : restUsed < s.rest;
  // A tap today only matters when today is a training day with no planned rest left.
  const skipsLeft = Math.max(0, s.skips - skipsUsed - (todayTaken && !plannedRestToday ? 1 : 0));
  return {
    streak,
    todayDone,
    todayRest: todayTaken,
    plannedRestToday,
    canTakeRest: !todayDone && !todayTaken && !plannedRestToday && skipsLeft > 0,
    skipsPerWeek: s.skips,
    skipsLeft,
    plannedRestLeft: s.mode === 'flex' ? Math.max(0, s.rest - restUsed) : null,
    brokeOn
  };
}

function explain(schedule) {
  const S = schedule;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const plan = S.mode === 'weekdays'
    ? `Training days: ${S.days.map((d) => names[d]).join(', ')}. Other days are rest days.`
    : `${S.rest} rest day${S.rest === 1 ? '' : 's'} a week${S.source === 'program' ? ` (from ${S.program})` : S.source === 'default' ? ' (default)' : ''}.`;
  const skip = S.skips ? ` Up to ${S.skips} extra rest day${S.skips === 1 ? '' : 's'} a week with “Take a rest day”.` : '';
  return `Counts the training days you complete in a row. Rest days don't break it. ${plan}${skip} Today never breaks it.`;
}

async function streakFor(userId, today) {
  const from = shiftKey(today, -LOOKBACK - 7);
  const [logs, rests, settings, recent] = await Promise.all([
    WorkoutLog.find({ user: userId, date: { $gte: from, $lte: today } }).select('date').lean(),
    RestDay.find({ user: userId, date: { $gte: from, $lte: today } }).select('date').lean(),
    Settings.findOne({ user: userId }).select('trainingDays restDaysPerWeek restSkipsPerWeek').lean(),
    WorkoutLog.findOne({ user: userId, planDay: { $regex: '^[a-z0-9_]+:' }, date: { $gte: shiftKey(today, -28), $lte: today } }).sort({ date: -1, createdAt: -1 }).select('planDay').lean()
  ]);
  const schedule = resolveSchedule(settings, recent && recent.planDay);
  const out = computeStreak({ workouts: new Set(logs.map((l) => l.date)), rests: new Set(rests.map((r) => r.date)), today, schedule });
  return { ...out, schedule, explanation: explain(schedule) };
}

module.exports = { computeStreak, resolveSchedule, streakFor, explain, weekStart, weekday, DEFAULT_REST };
