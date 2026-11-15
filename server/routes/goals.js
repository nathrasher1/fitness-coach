const express = require('express');
const Goal = require('../models/Goal');
const Weight = require('../models/Weight');
const { requireAuth } = require('../middleware/auth');
const GW = require('../services/goalWeight');

const router = express.Router();
router.use(requireAuth);

async function latestWeightLbs(userId) {
  const w = await Weight.findOne({ user: userId }).sort({ date: -1, createdAt: -1 }).lean();
  return w && w.weight != null ? Number(w.weight) : null;
}

function withComputed(goal, currentWeightLbs) {
  const doc = goal && typeof goal.toObject === 'function' ? goal.toObject() : { ...(goal || {}) };
  const goalWeightLbs = GW.computedGoalWeightLbs({
    type: doc.type,
    amountLbs: doc.amountLbs,
    startWeight: doc.startWeight,
    targetWeightLbs: doc.targetWeightLbs,
    currentWeightLbs
  });
  return { ...doc, goalWeightLbs, currentWeightLbs };
}

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    let goal = await Goal.findOne({ user: req.session.userId });
    if (!goal) {
      goal = await Goal.create({ user: req.session.userId });
    }
    const currentWeightLbs = await latestWeightLbs(req.session.userId);
    res.json(withComputed(goal, currentWeightLbs));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load goal' });
  }
});

// PUT /api/goals
router.put('/', async (req, res) => {
  try {
    const { type, amountLbs, weeks, targetDate, startWeight, proteinG, carbsG, fatG, goalWeightLbs, targetWeightLbs } = req.body;
    const currentWeightLbs = await latestWeightLbs(req.session.userId);
    const kind = type || 'maintain';
    const start = startWeight != null && startWeight !== '' ? Number(startWeight) : undefined;
    const wanted = goalWeightLbs != null ? goalWeightLbs : targetWeightLbs;

    let nextAmount = amountLbs != null ? Number(amountLbs) : 0;
    let nextTarget = wanted != null && wanted !== '' ? Number(wanted) : undefined;

    if (wanted != null && wanted !== '') {
      const check = GW.validateGoalWeight({
        type: kind,
        goalWeightLbs: wanted,
        startWeight: start,
        currentWeightLbs
      });
      if (!check.ok) return res.status(400).json({ error: check.error });
      const derived = GW.amountLbsFromGoalWeight({
        type: kind,
        goalWeightLbs: wanted,
        startWeight: start,
        currentWeightLbs
      });
      if (derived == null && kind !== 'maintain') {
        return res.status(400).json({ error: 'Add a starting weight or a weigh-in so we can derive the amount to lose or gain.' });
      }
      nextAmount = kind === 'maintain' ? 0 : derived;
      nextTarget = Number(wanted);
    }

    const goal = await Goal.findOneAndUpdate(
      { user: req.session.userId },
      {
        type: kind,
        amountLbs: nextAmount,
        weeks: weeks != null ? Number(weeks) : 12,
        targetDate: targetDate || '',
        startWeight: start,
        targetWeightLbs: nextTarget,
        proteinG,
        carbsG,
        fatG,
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(withComputed(goal, currentWeightLbs));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save goal' });
  }
});

module.exports = router;
