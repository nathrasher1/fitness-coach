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
    const { unit, foodWeightUnit, calAvgDays, interests, lengthUnit, trainingFocus, theme } = req.body;
    const update = {
      unit: unit || 'lbs',
      foodWeightUnit: foodWeightUnit === 'oz' ? 'oz' : 'g',
      calAvgDays: calAvgDays || 14,
      lengthUnit: lengthUnit === 'cm' ? 'cm' : 'in',
      theme: theme || 'sage',
      updatedAt: new Date()
    };
    if (Array.isArray(interests)) {
      update.interests = interests.map((s) => String(s).trim()).filter(Boolean);
    }
    if (Array.isArray(trainingFocus)) {
      update.trainingFocus = trainingFocus.map((s) => String(s).trim()).filter(Boolean);
    }
    const settings = await Settings.findOneAndUpdate(
      { user: req.session.userId },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
