const express = require('express');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.session.userId });
    if (!settings) {
      settings = await Settings.create({ user: req.session.userId });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const { unit, foodWeightUnit, calAvgDays } = req.body;
    const settings = await Settings.findOneAndUpdate(
      { user: req.session.userId },
      {
        unit: unit || 'lbs',
        foodWeightUnit: foodWeightUnit === 'oz' ? 'oz' : 'g',
        calAvgDays: calAvgDays || 14,
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
