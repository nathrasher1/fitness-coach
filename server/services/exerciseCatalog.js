const Exercise = require('../models/Exercise');

const keyOf = (name) => String(name || '').trim().toLowerCase();

/**
 * Add any built-in exercises that are missing (matched by exact system name, case-insensitive).
 * Never edits or removes existing exercises.
 */
function allSystemExercises() {
  const { seedExercises } = require('../../data/seed-exercises');
  const list = [];
  const seen = new Set();
  for (const e of seedExercises || []) {
    const k = keyOf(e.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    list.push(e);
  }
  return list;
}

async function ensureBuiltInExercises(list = allSystemExercises()) {
  const existing = await Exercise.find({ isSystem: true }, { name: 1 }).lean();
  const have = new Set(existing.map((e) => keyOf(e.name)));
  const missing = list
    .filter((e) => !have.has(keyOf(e.name)))
    .map((e) => ({ ...e, isSystem: true, user: null }));
  if (missing.length) await Exercise.insertMany(missing, { ordered: false });
  return { added: missing.length, total: list.length };
}

const MACHINE_QUERY = /^(machines?|cables?)$/i;

function isMachineQuery(q) {
  return MACHINE_QUERY.test(String(q || '').trim());
}

/** Equipment values treated as the Machine catalog filter. */
function machineEquipmentList() {
  return ['machine', 'cable'];
}

function parseEquipment(raw) {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function exerciseSearchFilter({ q, pattern, equipment, userId }) {
  const filter = {
    $or: [{ isSystem: true }, { user: userId }]
  };
  const machineQ = isMachineQuery(q);
  let equip = parseEquipment(equipment);
  if (machineQ && !equip.length) equip = machineEquipmentList();
  if (equip.length === 1) filter.equipment = equip[0];
  else if (equip.length > 1) filter.equipment = { $in: equip };
  if (q && !machineQ) {
    const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escaped, $options: 'i' };
  }
  if (pattern) filter.pattern = pattern;
  return filter;
}

function exerciseSearchLimit({ equipment, q, limit }) {
  const requested = Number(limit);
  const fallback = (parseEquipment(equipment).length || isMachineQuery(q)) ? 200 : 80;
  const n = Number.isFinite(requested) && requested > 0 ? requested : fallback;
  return Math.min(Math.max(1, n), 300);
}

module.exports = {
  ensureBuiltInExercises,
  allSystemExercises,
  isMachineQuery,
  machineEquipmentList,
  parseEquipment,
  exerciseSearchFilter,
  exerciseSearchLimit
};
