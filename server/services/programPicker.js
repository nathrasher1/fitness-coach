/**
 * Rank suggested workout programs for one or more activities.
 * Empty selection → no suggestions (the Workouts page starts blank until the user picks).
 * Multiple selections → union of matches, deduped by program id (best score kept).
 */
const A = require('../../client/lib/activities');

const GENERAL_IDS = ['full_body_3day', 'upper_lower', 'mobility_core'];

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
 * @returns {{ program, score, why }[]}
 */
function choosePrograms(activities, programs) {
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

  return [...byId.values()].sort(
    (a, b) => b.score - a.score || String(a.program.name).localeCompare(String(b.program.name))
  );
}

module.exports = { parseActivities, choosePrograms, forOne, GENERAL_IDS };
