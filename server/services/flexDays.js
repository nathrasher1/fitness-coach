// Holiday / flex days: mark a day so it never breaks streaks. The scale-free estimate
// (services/flexEstimator) counts in weekly totals and the weight trend as soft data.
// Cap ~4 per calendar month by default.
const { isDateKey, shiftKey } = require('./dates');

const DEFAULT_CAP = 4;

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
 * Sufficiency with flex days as soft data: a flex day with an estimate counts as a logged
 * food day (so it never triggers the "insufficient logs" caveat). Reported separately.
 */
function sufficiencyWithFlex(foodDates, weightDates, todayKey, flexKeys, SUFFICIENT) {
  const from = shiftKey(todayKey, -(SUFFICIENT.windowDays - 1));
  const inWin = (d) => d >= from && d <= todayKey;
  const flex = flexKeys instanceof Set ? flexKeys : new Set(flexKeys || []);
  const hard = new Set(foodDates.filter((d) => inWin(d) && !flex.has(d)));
  const soft = [...flex].filter(inWin).length;
  const weighIns = new Set(weightDates.filter(inWin)).size;
  return {
    ...SUFFICIENT, from, to: todayKey,
    loggedFoodDays: hard.size, flexDaysInWindow: soft, effectiveFoodDays: hard.size + soft,
    loggedWeighIns: weighIns,
    ok: hard.size + soft >= SUFFICIENT.foodDays && weighIns >= SUFFICIENT.weighIns
  };
}

/**
 * Weighted average daily intake. days: [{ kcal, soft }]; soft (flex-estimate) days get weight
 * SOFT_WEIGHT so one uncertain feast moves the average less than a logged day would.
 */
const SOFT_WEIGHT = 0.5;
function weightedAverage(days) {
  let num = 0, den = 0;
  for (const d of days || []) { if (!(d.kcal > 0)) continue; const w = d.soft ? SOFT_WEIGHT : 1; num += w * d.kcal; den += w; }
  return den ? num / den : null;
}

function canAddFlex({ existingCount, cap, alreadyMarked }) {
  if (alreadyMarked) return { ok: true, reason: null };
  const c = normalizeCap(cap);
  if (existingCount >= c) return { ok: false, reason: `You've used your ${c} flex day${c === 1 ? '' : 's'} for this month` };
  return { ok: true, reason: null };
}

module.exports = {
  DEFAULT_CAP,
  SOFT_WEIGHT,
  thanksgiving,
  holidayPresets,
  monthKey,
  monthBounds,
  normalizeCap,
  bufferDates,
  bufferPlan,
  sufficiencyWithFlex,
  weightedAverage,
  canAddFlex
};
