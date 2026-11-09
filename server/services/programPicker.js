/**
 * Rank suggested workout programs for one or more activities.
 * Empty selection → no suggestions (the Workouts page starts blank until the user picks).
 * Multiple selections → union of matches, deduped by program id (best score kept).
 * Optional daysPerWeek → exact day-count match only (no invented/compressed plans).
 */
const A = require('../../client/lib/activities');

const GENERAL_IDS = ['full_body_3day', 'upper_lower', 'mobility_core'];
/** Day counts present in the shipped PROGRAMS catalog (mutated by syncCatalogDayOptions). */
const CATALOG_DAY_OPTIONS = [2, 3, 4];

/** Unique day lengths from a programs array (1–7). */
function deriveCatalogDayOptions(programs) {
  const set = new Set();
  for (const p of programs || []) {
    const n = p && Array.isArray(p.days) ? p.days.length : 0;
    if (Number.isInteger(n) && n >= 1 && n <= 7) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/** Keep CATALOG_DAY_OPTIONS in lockstep with the live catalog (in-place mutate). */
function syncCatalogDayOptions(programs) {
  const derived = deriveCatalogDayOptions(programs);
  if (derived.length) {
    CATALOG_DAY_OPTIONS.length = 0;
    CATALOG_DAY_OPTIONS.push(...derived);
  }
  return CATALOG_DAY_OPTIONS;
}

/** Parse ?activities=a,b and/or repeated ?activity= / ?focus= into a unique list. */
function parseActivities(query = {}) {
  const out = [];
  const add = (v) => {
    String(v == null ? '' : v)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        const t = s.slice(0, 80);
        if (t && !out.includes(t)) out.push(t);
      });
  };
  add(query.activities);
  const act = query.activity;
  if (Array.isArray(act)) act.forEach(add);
  else add(act);
  const focus = query.focus;
  if (Array.isArray(focus)) focus.forEach(add);
  else add(focus);
  return out;
}

/** Parse days/week filter. null = any. Only exact integers; unknown values → null (any). */
function parseDaysPerWeek(query = {}, fallback = null) {
  const has =
    Object.prototype.hasOwnProperty.call(query, 'daysPerWeek') ||
    Object.prototype.hasOwnProperty.call(query, 'days');
  if (!has) return normalizeDaysPerWeek(fallback);
  const raw = query.daysPerWeek != null ? query.daysPerWeek : query.days;
  // Explicit "any" (or empty) clears the filter even if a saved preference exists.
  if (raw == null || raw === '' || String(raw).toLowerCase() === 'any') return null;
  return normalizeDaysPerWeek(raw);
}

function normalizeDaysPerWeek(v) {
  if (v == null || v === '' || String(v).toLowerCase() === 'any') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || !CATALOG_DAY_OPTIONS.includes(n)) return null;
  return n;
}

function forOne(activity, programs) {
  const arches = A.archetypesFor(activity);
  const weights = new Map(arches.map((a, i) => [a, i === 0 ? 2 : 1]));
  const hit = A.lookup(activity);
  const label = hit
    ? hit.name
    : A.ARCHETYPES[activity]
      ? A.ARCHETYPES[activity].label.replace(/ \(.*\)$/, '')
      : activity;
  const ranked = A.rankPrograms(programs, weights).filter((r) => r.score > 0);
  const out = ranked.map((r) => ({ program: r.p, score: r.score, why: label }));
  // Always leave a general option at the end as a fallback when something was selected.
  const backup = programs.find((p) => p.id === 'full_body_3day');
  if (backup && !out.some((r) => r.program.id === backup.id)) {
    out.push({ program: backup, score: 0, why: null });
  }
  return out;
}

/**
 * @param {string[]} activities selected activity names and/or archetype keys
 * @param {object[]} programs PROGRAMS catalog
 * @param {{ daysPerWeek?: number|null }} [opts]
 * @returns {{ program, score, why }[]}
 */
function choosePrograms(activities, programs, opts = {}) {
  const list = (activities || []).map((a) => String(a || '').trim()).filter(Boolean);
  if (!list.length) return [];

  const byId = new Map();
  for (const activity of list) {
    for (const row of forOne(activity, programs)) {
      const id = row.program.id;
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, { program: row.program, score: row.score, why: row.why });
        continue;
      }
      const whys = new Set(
        [...String(prev.why || '').split(', '), ...String(row.why || '').split(', ')]
          .map((s) => s.trim())
          .filter(Boolean)
      );
      byId.set(id, {
        program: prev.program,
        score: Math.max(prev.score, row.score),
        why: whys.size ? [...whys].join(', ') : null
      });
    }
  }

  let out = [...byId.values()].sort(
    (a, b) => b.score - a.score || String(a.program.name).localeCompare(String(b.program.name))
  );
  const days = normalizeDaysPerWeek(opts.daysPerWeek);
  if (days != null) {
    out = out.filter((r) => Array.isArray(r.program.days) && r.program.days.length === days);
  }
  return out;
}

module.exports = {
  parseActivities,
  parseDaysPerWeek,
  normalizeDaysPerWeek,
  choosePrograms,
  forOne,
  GENERAL_IDS,
  CATALOG_DAY_OPTIONS,
  deriveCatalogDayOptions,
  syncCatalogDayOptions
};
