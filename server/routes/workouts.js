const express = require('express');
const Exercise = require('../models/Exercise');
const Routine = require("../models/Routine");
const WorkoutLog = require('../models/WorkoutLog');
const Settings = require('../models/Settings');
const WorkoutDraft = require('../models/WorkoutDraft');
const { requireAuth } = require('../middleware/auth');
const P = require('../../client/lib/progression');

const router = express.Router();
router.use(requireAuth);

// GET /api/workouts/exercises?q=&pattern=&equipment=
router.get('/exercises', async (req, res) => {
  try {
    const filter = {
      $or: [{ isSystem: true }, { user: req.session.userId }]
    };
    if (req.query.q) {
      filter.name = { $regex: req.query.q, $options: 'i' };
    }
    if (req.query.pattern) filter.pattern = req.query.pattern;
    if (req.query.equipment) filter.equipment = req.query.equipment;

    const exercises = await Exercise.find(filter).sort({ name: 1 }).limit(80);
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search exercises' });
  }
});

// GET /api/workouts/exercises/:id/swaps – same movement pattern
router.get('/exercises/:id/swaps', async (req, res) => {
  try {
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    const swaps = await Exercise.find({
      pattern: ex.pattern,
      _id: { $ne: ex._id },
      $or: [{ isSystem: true }, { user: req.session.userId }]
    }).limit(15);
    res.json({ exercise: ex, swaps });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load swaps' });
  }
});

const PROGRAMS = [
  {
    id: 'full_body_3day',
    name: 'Full Body 3×/week',
    focus: 'general',
    days: [
      { name: 'Day A', exercises: ['Back Squat', 'Bench Press', 'Barbell Row', 'Plank'] },
      { name: 'Day B', exercises: ['Romanian Deadlift', 'Overhead Press', 'Pull-Up', 'Farmer Carry'] },
      { name: 'Day C', exercises: ['Front Squat', 'Incline Dumbbell Press', 'Seated Cable Row', 'Hanging Leg Raise'] }
    ]
  },
  {
    id: 'upper_lower',
    name: 'Upper / Lower 4×/week',
    focus: 'general',
    days: [
      { name: 'Upper A', exercises: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Lat Pulldown', 'Lateral Raise'] },
      { name: 'Lower A', exercises: ['Back Squat', 'Romanian Deadlift', 'Walking Lunge', 'Calf Raise'] },
      { name: 'Upper B', exercises: ['Incline Dumbbell Press', 'Pull-Up', 'Dumbbell Shoulder Press', 'Seated Cable Row', 'Face Pull'] },
      { name: 'Lower B', exercises: ['Trap Bar Deadlift', 'Front Squat', 'Bulgarian Split Squat', 'Leg Curl'] }
    ]
  },
  {
    id: 'bjj_strength',
    name: 'BJJ Strength Support',
    focus: 'jiu-jitsu',
    notes: 'Prioritize grip, hip hinge, rotational core, and posterior chain. Keep volume moderate on hard mat weeks.',
    days: [
      { name: 'Pull + Hinge', exercises: ['Romanian Deadlift', 'Pull-Up', 'Seated Cable Row', 'Farmer Carry', 'Dead Bug'] },
      { name: 'Push + Squat', exercises: ['Front Squat', 'Bench Press', 'Overhead Press', 'Walking Lunge', 'Pallof Press'] },
      { name: 'Conditioning', exercises: ['Sled Push', 'Battle Ropes', 'Kettlebell Swing', 'Box Jump'] }
    ]
  },
  {
    id: 'football',
    name: 'Football / Power',
    focus: 'football',
    days: [
      { name: 'Lower Power', exercises: ['Back Squat', 'Trap Bar Deadlift', 'Box Jump', 'Sled Push'] },
      { name: 'Upper Power', exercises: ['Bench Press', 'Barbell Row', 'Push Press', 'Medicine Ball Slam'] },
      { name: 'Total', exercises: ['Power Clean', 'Front Squat', 'Pull-Up', 'Farmer Carry'] }
    ]
  },
  {
    id: 'softball',
    name: 'Softball / Rotational',
    focus: 'softball',
    days: [
      { name: 'Lower', exercises: ['Front Squat', 'Romanian Deadlift', 'Lateral Lunge', 'Calf Raise'] },
      { name: 'Upper + Rotate', exercises: ['Dumbbell Bench Press', 'Single-Arm Dumbbell Row', 'Landmine Press', 'Pallof Press', 'Face Pull'] }
    ]
  },
  {
    id: 'wakeboard',
    name: 'Wakeboard / Water Sports',
    focus: 'wakeboarding',
    notes: 'Emphasize grip, posterior chain, and anti-rotation core.',
    days: [
      { name: 'Posterior', exercises: ['Romanian Deadlift', 'Kettlebell Swing', 'Pull-Up', 'Farmer Carry'] },
      { name: 'Legs + Core', exercises: ['Goblet Squat', 'Walking Lunge', 'Pallof Press', 'Dead Bug', 'Box Jump'] }
    ]
  }
];

const MUSCLE_FIELDS = 'name pattern primaryMuscles secondaryMuscles equipment category imageUrl';

/** Look up library exercises by name (case-insensitive) so plan days can show muscles / thumbnails. */
async function exerciseLookup(names, userId) {
  const unique = [...new Set(names.filter(Boolean))];
  if (!unique.length) return new Map();
  const docs = await Exercise.find({
    name: { $in: unique },
    $or: [{ isSystem: true }, { user: userId }]
  }).collation({ locale: 'en', strength: 2 }).select(MUSCLE_FIELDS).lean();
  const map = new Map();
  docs.forEach((d) => map.set(d.name.toLowerCase(), d));
  return map;
}

function detailFor(name, doc, defaults) {
  const isLower = P.isLowerBody(doc || { name });
  const compound = !doc || doc.category !== 'isolation';
  return {
    name,
    exerciseId: doc ? doc._id : null,
    pattern: doc?.pattern || '',
    primaryMuscles: doc?.primaryMuscles || [],
    secondaryMuscles: doc?.secondaryMuscles || [],
    imageUrl: doc?.imageUrl || '',
    equipment: doc?.equipment || [],
    isLower,
    targetSets: compound ? defaults.sets : Math.max(2, defaults.sets - 1),
    repMin: defaults.low,
    repMax: defaults.high
  };
}

// GET /api/workouts/programs – suggested splits by sport focus
// Each day keeps `exercises` (names, unchanged) and gains `details` (muscles, targets) for plan cards.
router.get('/programs', async (req, res) => {
  const programs = PROGRAMS;
  const settings = await Settings.findOne({ user: req.session.userId });
  const interests = (settings?.interests || []).map((s) => s.toLowerCase());
  const focus = req.query.focus;
  const matched = programs.filter((p) => {
    if (focus) return p.focus === focus || p.focus === 'general';
    if (!interests.length) return true;
    return p.focus === 'general' || interests.some((i) => i.includes(p.focus) || p.focus.includes(i.split(' ')[0]));
  });
  const chosen = matched.length ? matched : programs;
  try {
    const focusName = (settings?.trainingFocus || [])[0];
    const range = P.rangeFor({ focus: focusName });
    const defaults = { sets: range.focus === 'strength' || range.focus === 'power' ? 4 : 3, low: range.low, high: range.high };
    const orders = settings?.programOrders || null;
    const customNames = orders ? [...orders.values()].flat() : [];
    const lookup = await exerciseLookup([...chosen.flatMap((p) => p.days.flatMap((d) => d.exercises)), ...customNames], req.session.userId);
    res.json(chosen.map((p) => ({
      ...p,
      days: p.days.map((d, i) => {
        const planDay = `${p.id}:${d.name}`;
        const custom = orders && orders.get(planDay);
        const exercises = custom && custom.length ? custom : d.exercises;
        return {
          ...d,
          exercises,
          customized: !!(custom && custom.length),
          number: i + 1,
          planDay,
          details: exercises.map((n) => detailFor(n, lookup.get(n.toLowerCase()), defaults))
        };
      })
    })));
  } catch (err) {
    console.error(err);
    res.json(chosen);
  }
});

// ---------- In-progress workout draft (autosave) ----------
const MAX_DRAFT_BYTES = 200 * 1024;

// GET /api/workouts/draft – the user's unfinished session, or { draft: null }
router.get('/draft', async (req, res) => {
  try {
    const d = await WorkoutDraft.findOne({ user: req.session.userId }).lean();
    if (!d || !d.data) return res.json({ draft: null, clearedAt: d ? d.savedAt : null });
    res.json({ draft: { data: d.data, savedAt: d.savedAt } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load draft' });
  }
});

// PUT /api/workouts/draft { data, savedAt } – upsert unless the stored copy is newer
router.put('/draft', async (req, res) => {
  try {
    const { data } = req.body || {};
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.exercises)) {
      return res.status(400).json({ error: 'data.exercises array required' });
    }
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_DRAFT_BYTES) return res.status(413).json({ error: 'Draft too large' });
    const t = new Date(req.body.savedAt || Date.now());
    const savedAt = Number.isNaN(t.getTime()) ? new Date() : new Date(Math.min(t.getTime(), Date.now() + 60000));
    const existing = await WorkoutDraft.findOne({ user: req.session.userId }).lean();
    if (existing && existing.savedAt > savedAt) {
      return res.status(409).json({ error: 'A newer draft exists', stale: true, savedAt: existing.savedAt });
    }
    await WorkoutDraft.updateOne({ user: req.session.userId }, { $set: { data, savedAt } }, { upsert: true });
    res.json({ ok: true, savedAt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// DELETE /api/workouts/draft – clear (Finish/Discard); leaves a tombstone timestamp
router.delete('/draft', async (req, res) => {
  try {
    const t = new Date(req.query.at || Date.now());
    const savedAt = Number.isNaN(t.getTime()) ? new Date() : new Date(Math.min(t.getTime(), Date.now() + 60000));
    await WorkoutDraft.updateOne({ user: req.session.userId }, { $set: { data: null, savedAt } }, { upsert: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear draft' });
  }
});

// PUT /api/workouts/program-order { planDay, exercises: [names] } – remember a reordered/swapped program day
router.put('/program-order', async (req, res) => {
  try {
    const planDay = String(req.body.planDay || '');
    const [pid, ...rest] = planDay.split(':');
    const prog = PROGRAMS.find((p) => p.id === pid);
    const day = prog && prog.days.find((d) => d.name === rest.join(':'));
    if (!day || /[.$]/.test(planDay)) return res.status(400).json({ error: 'Unknown program day' });
    const list = Array.isArray(req.body.exercises) ? req.body.exercises : null;
    const key = `programOrders.${planDay}`;
    if (!list || !list.length) {
      await Settings.updateOne({ user: req.session.userId }, { $unset: { [key]: 1 } });
      return res.json({ planDay, exercises: day.exercises, reset: true });
    }
    const names = list.map((n) => String(n || '').trim().slice(0, 80)).filter(Boolean).slice(0, 20);
    if (!names.length) return res.status(400).json({ error: 'exercises required' });
    await Settings.findOneAndUpdate({ user: req.session.userId }, { $set: { [key]: names } }, { upsert: true, setDefaultsOnInsert: true });
    res.json({ planDay, exercises: names });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save order' });
  }
});

// GET /api/workouts – recent workout logs
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const logs = await WorkoutLog.find({ user: req.session.userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load workouts' });
  }
});

// POST /api/workouts
router.post('/', async (req, res) => {
  try {
    const { date, name, notes, durationMin, exercises } = req.body;
    if (exercises != null && !Array.isArray(exercises)) {
      return res.status(400).json({ error: 'exercises must be an array' });
    }
    if (!date || !exercises?.length) {
      return res.status(400).json({ error: 'date and exercises required' });
    }
    const log = await WorkoutLog.create({
      user: req.session.userId,
      date,
      name: name || 'Workout',
      notes: notes || '',
      durationMin: durationMin || null,
      planDay: typeof req.body.planDay === 'string' ? req.body.planDay.slice(0, 200) : '',
      exercises: exercises.map((e) => ({
        exercise: e.exerciseId || null,
        exerciseName: e.exerciseName,
        equipment: e.equipment || '',
        restSec: Number(e.restSec) >= 0 && Number(e.restSec) <= 900 ? Number(e.restSec) : undefined,
        sets: (e.sets || []).map((s) => ({
          type: P.SET_TYPES.includes(s.type) ? s.type : 'working',
          reps: s.reps != null ? Number(s.reps) : undefined,
          weight: s.weight != null ? Number(s.weight) : undefined,
          rpe: s.rpe != null ? Number(s.rpe) : undefined,
          distanceM: s.distanceM != null ? Number(s.distanceM) : undefined,
          durationSec: s.durationSec != null ? Number(s.durationSec) : undefined,
          note: s.note || ''
        }))
      }))
    });
    res.status(201).json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save workout' });
  }
});

// DELETE /api/workouts/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await WorkoutLog.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// GET /api/workouts/suggest-load?exerciseId=&name=&repMin=&repMax=
// Double progression from the last session (warm-ups ignored), plus last sets, e1RM and best e1RM.
// Original fields (ready, lastSets, suggestion.weight/reps/note) are kept for older clients.
router.get('/suggest-load', async (req, res) => {
  try {
    const exerciseId = req.query.exerciseId && req.query.exerciseId !== 'null' ? String(req.query.exerciseId) : '';
    const exerciseName = req.query.name ? String(req.query.name) : '';
    if (!exerciseId && !exerciseName) {
      return res.status(400).json({ error: 'exerciseId or name required' });
    }

    const [logs, settings, exDoc] = await Promise.all([
      WorkoutLog.find({ user: req.session.userId }).sort({ date: -1, createdAt: -1 }).limit(60).lean(),
      Settings.findOne({ user: req.session.userId }).lean(),
      exerciseId && /^[a-f0-9]{24}$/i.test(exerciseId)
        ? Exercise.findById(exerciseId).select(MUSCLE_FIELDS).lean()
        : Promise.resolve(null)
    ]);
    const nameLc = (exerciseName || exDoc?.name || '').toLowerCase();
    const matches = (e) =>
      (exerciseId && e.exercise && e.exercise.toString() === exerciseId) ||
      (nameLc && String(e.exerciseName || '').toLowerCase() === nameLc);

    let last = null;
    let bestE1rm = 0;
    let lastRestSec = null;
    for (const log of logs) {
      for (const e of log.exercises || []) {
        if (!matches(e) || !e.sets?.length) continue;
        const sets = e.sets.map((x) => ({ ...x, type: P.setType(x) }));
        if (!last) { last = { date: log.date, sets }; lastRestSec = e.restSec ?? null; }
        bestE1rm = Math.max(bestE1rm, P.bestE1rm(sets).value);
      }
    }

    const focus = (settings?.trainingFocus || [])[0] || 'hypertrophy';
    const unit = settings?.unit === 'kg' ? 'kg' : 'lbs';
    const range = P.rangeFor({ focus, repMin: req.query.repMin, repMax: req.query.repMax });
    const key = exerciseId || nameLc;
    const saved = settings?.restTimers ? settings.restTimers[key] : undefined;
    const restSec = Number.isFinite(saved) ? saved : (lastRestSec ?? 90);
    const exInfo = exDoc || { name: exerciseName };
    const isLower = P.isLowerBody(exInfo);
    const note = `${focus}: aim for ${range.low}–${range.high} reps`;

    if (!last) {
      return res.json({
        ready: false,
        reason: 'No prior sets for this exercise',
        restSec,
        isLower,
        bestE1rm: 0,
        suggestion: { reps: range.low, note: `${focus}: start around ${range.low}–${range.high} reps`, action: 'start', range }
      });
    }

    const next = P.suggestNext(last.sets, { unit, focus, repMin: req.query.repMin, repMax: req.query.repMax, isLower });
    res.json({
      ready: true,
      lastSets: last.sets,
      lastDate: last.date,
      lastE1rm: Math.round(P.bestE1rm(last.sets).value),
      bestE1rm: Math.round(bestE1rm),
      restSec,
      isLower,
      suggestion: {
        weight: next.weight,
        reps: next.reps,
        note,
        reason: next.reason,
        action: next.action,
        deltaLbs: next.deltaLbs,
        factor: next.factor,
        range: next.range
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to suggest load' });
  }
});


// ========== Routines ==========
function routineExtras(e) {
  const out = {};
  ["repMin", "repMax", "targetWeight", "restSec"].forEach((k) => {
    const v = Number(e[k]);
    if (e[k] != null && Number.isFinite(v) && v >= 0) out[k] = v;
  });
  return out;
}

// GET /api/workouts/routines
router.get("/routines", async (req, res) => {
  try {
    const routines = await Routine.find({ user: req.session.userId }).sort({ updatedAt: -1 }).lean();
    const lookup = await exerciseLookup(routines.flatMap((r) => r.exercises.map((e) => e.exerciseName)), req.session.userId);
    res.json(routines.map((r) => ({
      ...r,
      planDay: `routine:${r._id}`,
      details: r.exercises.map((e) => {
        const d = detailFor(e.exerciseName, lookup.get(String(e.exerciseName).toLowerCase()), {
          sets: e.targetSets || 3, low: e.repMin || e.targetReps || 8, high: e.repMax || e.targetReps || 8
        });
        return { ...d, exerciseId: e.exercise || d.exerciseId, targetSets: e.targetSets || 3, targetReps: e.targetReps || 8, restSec: e.restSec };
      })
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to load routines" });
  }
});

// POST /api/workouts/routines
router.post("/routines", async (req, res) => {
  try {
    const { name, notes, exercises } = req.body;
    if (!name || !exercises?.length) return res.status(400).json({ error: "name and exercises required" });
    const routine = await Routine.create({
      user: req.session.userId,
      name: name.trim(),
      notes: notes || "",
      exercises: exercises.map(e => ({
        exercise: e.exerciseId || null,
        exerciseName: e.exerciseName,
        targetSets: e.targetSets || 3,
        targetReps: e.targetReps || 8,
        ...routineExtras(e),
        notes: e.notes || ""
      })),
      updatedAt: new Date()
    });
    res.status(201).json(routine);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save routine" });
  }
});

// PUT /api/workouts/routines/:id – rename / reorder / swap exercises
router.put("/routines/:id", async (req, res) => {
  try {
    const { name, notes, exercises } = req.body;
    const update = { updatedAt: new Date() };
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof notes === "string") update.notes = notes;
    if (exercises != null) {
      if (!Array.isArray(exercises) || !exercises.length) return res.status(400).json({ error: "exercises must be a non-empty array" });
      update.exercises = exercises.map((e) => ({
        exercise: e.exerciseId || e.exercise || null,
        exerciseName: String(e.exerciseName || ""),
        targetSets: e.targetSets || 3,
        targetReps: e.targetReps || 8,
        ...routineExtras(e),
        notes: e.notes || ""
      }));
      if (update.exercises.some((e) => !e.exerciseName)) return res.status(400).json({ error: "exerciseName required" });
    }
    const routine = await Routine.findOneAndUpdate({ _id: req.params.id, user: req.session.userId }, update, { new: true });
    if (!routine) return res.status(404).json({ error: "Not found" });
    res.json(routine);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update routine" });
  }
});

// DELETE /api/workouts/routines/:id
router.delete("/routines/:id", async (req, res) => {
  try {
    const result = await Routine.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (!result.deletedCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

module.exports = router;
