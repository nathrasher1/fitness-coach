const express = require('express');
const Goal = require('../models/Goal');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    let goal = await Goal.findOne({ user: req.session.userId });
    if (!goal) {
      goal = await Goal.create({ user: req.session.userId });
    }
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load goal' });
  }
});

// PUT /api/goals
router.put('/', async (req, res) => {
  try {
    const { type, amountLbs, weeks, startWeight, proteinG, carbsG, fatG } = req.body;

    const goal = await Goal.findOneAndUpdate(
      { user: req.session.userId },
      {
        type: type || 'maintain',
        amountLbs: amountLbs != null ? Number(amountLbs) : 0,
        weeks: weeks != null ? Number(weeks) : 12,
        startWeight: startWeight != null ? Number(startWeight) : undefined,
        proteinG,
        carbsG,
        fatG,
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save goal' });
  }
});

module.exports = router;
