const express = require('express');
const Exercise = require('../models/Exercise');
const Routine = require("../models/Routine");
const WorkoutLog = require('../models/WorkoutLog');
const { requireAuth } = require('../middleware/auth');

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

// GET /api/workouts/programs – suggested splits by sport focus
router.get('/programs', (req, res) => {
  const programs = [
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
  const focus = req.query.focus;
  res.json(focus ? programs.filter((p) => p.focus === focus || p.focus === 'general') : programs);
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
    if (!date || !exercises?.length) {
      return res.status(400).json({ error: 'date and exercises required' });
    }
    const log = await WorkoutLog.create({
      user: req.session.userId,
      date,
      name: name || 'Workout',
      notes: notes || '',
      durationMin: durationMin || null,
      exercises: exercises.map((e) => ({
        exercise: e.exerciseId || null,
        exerciseName: e.exerciseName,
        equipment: e.equipment || '',
        sets: (e.sets || []).map((s) => ({
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

// GET /api/workouts/suggest-load?exerciseId= – simple progression from last log
router.get('/suggest-load', async (req, res) => {
  try {
    const exerciseId = req.query.exerciseId;
    const exerciseName = req.query.name;
    if (!exerciseId && !exerciseName) {
      return res.status(400).json({ error: 'exerciseId or name required' });
    }

    const logs = await WorkoutLog.find({ user: req.session.userId }).sort({ date: -1 }).limit(30);
    let lastSets = null;
    for (const log of logs) {
      const match = log.exercises.find((e) =>
        (exerciseId && e.exercise && e.exercise.toString() === exerciseId) ||
        (exerciseName && e.exerciseName === exerciseName)
      );
      if (match && match.sets?.length) {
        lastSets = match.sets;
        break;
      }
    }

    if (!lastSets) {
      return res.json({ ready: false, reason: 'No prior sets for this exercise' });
    }

    const top = lastSets.reduce((best, s) => {
      if (s.weight == null) return best;
      if (!best || s.weight > best.weight || (s.weight === best.weight && (s.reps || 0) > (best.reps || 0))) {
        return s;
      }
      return best;
    }, null);

    // Simple linear progression suggestion
    let suggestedWeight = top?.weight;
    let suggestedReps = top?.reps || 8;
    if (top?.reps >= 10 && top.weight) {
      suggestedWeight = Math.round((top.weight + 5) * 2) / 2; // +5 lbs
      suggestedReps = 6;
    } else if (top?.reps >= 8 && top.weight) {
      suggestedWeight = top.weight;
      suggestedReps = top.reps + 1;
    }

    res.json({
      ready: true,
      lastSets,
      suggestion: {
        weight: suggestedWeight,
        reps: suggestedReps,
        note: 'Based on your most recent top set — adjust for how you feel.'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to suggest load' });
  }
});


// ========== Routines ==========
// GET /api/workouts/routines
router.get("/routines", async (req, res) => {
  try {
    const routines = await Routine.find({ user: req.session.userId }).sort({ updatedAt: -1 });
    res.json(routines);
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
