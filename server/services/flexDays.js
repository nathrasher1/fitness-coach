// Holiday / flex days: mark a day so it never breaks streaks and is excluded
// from the weekly calorie average. Logging is optional (Light / Moderate / Feast
// presets, or none). Cap ~4 per calendar month by default.
const { isDateKey, shiftKey } = require('./dates');

const DEFAULT_CAP = 4;
const ESTIMATE_PRESETS = {
  none: { key: 'none', label: 'No log', addKcal: 0 },
  light: { key: 'light', label: 'Light', addKcal: 500 },
  moderate: { key: 'moderate', label: 'Moderate', addKcal: 1000 },
  feast: { key: 'feast', label: 'Feast', addKcal: 2000 }
};

// US-style floating holidays for the given year (local calendar keys).
function thanksgiving(year) {
  // Fourth Thursday of November
  const d = new Date(Date.UTC(year, 10, 1));
  const firstThu = 1 + ((11 - d.getUTCDay()) % 7); // day-of-month of first Thursday
  return `${year}-11-${String(firstThu + 21).padStart(2, '0')}`;
}

function holidayPresets(year) {
  const y = Number(year) || new Date().getUTCFullYear();
  return [
    { key: 'new_year', name: "New Year's Day", date: `${y}-01-01` },
    { key: 'july4', name: 'Independence Day', date: `${y}-07-04` },
    { key: 'thanksgiving', name: 'Thanksgiving', date: thanksgiving(y) },
    { key: 'christmas_eve', name: 'Christmas Eve', date: `${y}-12-24` },
    { key: 'christmas', name: 'Christmas', date: `${y}-12-25` },
    { key: 'new_years_eve', name: "New Year's Eve", date: `${y}-12-31` },
    // Next year's New Year for late-December planning
    { key: 'new_year_next', name: "New Year's Day (next)", date: `${y + 1}-01-01` }
  ].filter((h) => isDateKey(h.date));
}

function monthKey(dateKey) {
  return String(dateKey || '').slice(0, 7); // YYYY-MM
}

function monthBounds(dateKey) {
  const m = monthKey(dateKey);
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const [y, mo] = m.split('-').map(Number);
  const start = `${m}-01`;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate(); // day 0 of next month
  const end = `${m}-${String(last).padStart(2, '0')}`;
  return { start, end, month: m };
}

function normalizeCap(n) {
  if (n == null || n === '') return DEFAULT_CAP;
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_CAP;
  return Math.max(0, Math.min(10, Math.round(v)));
}

function normalizeEstimate(body) {
  const key = String((body && body.estimate) || 'none').toLowerCase();
  const preset = ESTIMATE_PRESETS[key] || ESTIMATE_PRESETS.none;
  let addKcal = preset.addKcal;
  if (body && body.addKcal != null && body.addKcal !== '') {
    const n = Number(body.addKcal);
    if (Number.isFinite(n)) addKcal = Math.max(0, Math.min(10000, Math.round(n)));
  }
  if (key === 'none' && (body == null || body.addKcal == null || body.addKcal === '')) addKcal = 0;
  return { estimate: preset.key, addKcal, label: preset.label };
}

/** Surrounding buffer days for adult opt-in (day before + day after). */
function bufferDates(dateKey) {
  if (!isDateKey(dateKey)) return [];
  return [shiftKey(dateKey, -1), shiftKey(dateKey, 1)];
}

/**
 * Spread a fraction of the flex-day surplus across surrounding days.
 * Only used when adult opt-in is on. Returns per-date kcal adjustments (positive = extra room).
 * Minors never get this (caller must gate).
 */
function bufferPlan(dateKey, addKcal, { fraction = 0.25, adult = true } = {}) {
  if (!adult || !(addKcal > 0) || !isDateKey(dateKey)) return [];
  const each = Math.round((addKcal * fraction) / 2);
  if (each <= 0) return [];
  return bufferDates(dateKey).map((date) => ({ date, addKcal: each }));
}

/**
 * Filter food/calorie log dates for weekly averages: drop flex-day keys so a
 * feast (or an empty flex day) doesn't drag suggested calories or trip the
 * "insufficient logs" caveat by itself.
 */
function excludeFlexFromDates(dateKeys, flexKeys) {
  const skip = flexKeys instanceof Set ? flexKeys : new Set(flexKeys || []);
  return (dateKeys || []).filter((d) => !skip.has(d));
}

/**
 * Sufficiency after excluding flex days from the food-day count (weigh-ins stay).
 * A flex day with no food log does not reduce loggedFoodDays.
 * A flex day WITH a food log also does not count toward the 5-day requirement
 * (and its calories are excluded from the average elsewhere).
 */
function sufficiencyExcludingFlex(foodDates, weightDates, todayKey, flexKeys, SUFFICIENT) {
  const from = shiftKey(todayKey, -(SUFFICIENT.windowDays - 1));
  const inWin = (d) => d >= from && d <= todayKey;
  const skip = flexKeys instanceof Set ? flexKeys : new Set(flexKeys || []);
  // Count non-flex food days; also treat a flex day inside the window as "covered"
  // so missing food on a marked flex day doesn't tank sufficiency.
  const foodDays = new Set(foodDates.filter((d) => inWin(d) && !skip.has(d))).size;
  const flexInWin = [...skip].filter(inWin).length;
  const effectiveFoodDays = foodDays + flexInWin; // flex days count as present without using their kcal
  const weighIns = new Set(weightDates.filter(inWin)).size;
  return {
    ...SUFFICIENT,
    from,
    to: todayKey,
    loggedFoodDays: foodDays,
    flexDaysInWindow: flexInWin,
    effectiveFoodDays,
    loggedWeighIns: weighIns,
    ok: effectiveFoodDays >= SUFFICIENT.foodDays && weighIns >= SUFFICIENT.weighIns
  };
}

function canAddFlex({ existingCount, cap, alreadyMarked }) {
  if (alreadyMarked) return { ok: true, reason: null };
  const c = normalizeCap(cap);
  if (existingCount >= c) return { ok: false, reason: `You've used your ${c} flex day${c === 1 ? '' : 's'} for this month` };
  return { ok: true, reason: null };
}

module.exports = {
  DEFAULT_CAP,
  ESTIMATE_PRESETS,
  thanksgiving,
  holidayPresets,
  monthKey,
  monthBounds,
  normalizeCap,
  normalizeEstimate,
  bufferDates,
  bufferPlan,
  excludeFlexFromDates,
  sufficiencyExcludingFlex,
  canAddFlex
};
