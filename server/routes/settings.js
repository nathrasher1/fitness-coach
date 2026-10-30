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

// PUT /api/settings/rest-timer { key, seconds } – remember the rest timer for one exercise
router.put('/rest-timer', async (req, res) => {
  try {
    const key = String(req.body.key || '').trim().slice(0, 120);
    const seconds = Math.round(Number(req.body.seconds));
    if (!key || /[.$]/.test(key)) return res.status(400).json({ error: 'valid key required' });
    if (!(seconds >= 0 && seconds <= 900)) return res.status(400).json({ error: 'seconds must be 0–900' });
    const settings = await Settings.findOneAndUpdate(
      { user: req.session.userId },
      { $set: { [`restTimers.${key}`]: seconds, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ key, seconds, restTimers: settings.restTimers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save rest timer' });
  }
});

module.exports = router;
