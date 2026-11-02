const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { localToday } = require('../services/dates');
const H = require('../services/health');
const { rateLimit } = require('../services/social');

const router = express.Router();
router.use(requireAuth);
const syncLimit = rateLimit({ name: 'health-sync', windowMs: 10 * 60_000, max: 30 });

// POST /api/health/sync { source, days: [{date, steps, activeKcal, distanceM}], workouts: [{externalId, start, end, date, type, name, app, durationMin, activeKcal, distanceM}] }
router.post('/sync', syncLimit, async (req, res) => {
  try { res.json({ ok: true, ...(await H.sync(req.session.userId, req.body || {})) }); }
  catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); console.error('Health sync error:', err && err.message); res.status(500).json({ error: 'Failed to save health data' }); }
});

// GET /api/health/summary?days=7
router.get('/summary', async (req, res) => {
  try { res.json(await H.summary(req.session.userId, localToday(req), req.query.days)); }
  catch (err) { console.error(err && err.message); res.status(500).json({ error: 'Failed to load health data' }); }
});

// GET /api/health/workouts?limit=15
router.get('/workouts', async (req, res) => {
  try { res.json(await H.recentWorkouts(req.session.userId, parseInt(req.query.limit, 10) || 15)); }
  catch (err) { res.status(500).json({ error: 'Failed to load imported workouts' }); }
});

// DELETE /api/health/data[?source=health_connect] – remove imported health data
router.delete('/data', async (req, res) => {
  try {
    const source = req.query.source && H.SOURCES.has(req.query.source) ? req.query.source : null;
    res.json({ ok: true, removed: await H.removeAll(req.session.userId, source) });
  } catch (err) { res.status(500).json({ error: 'Failed to remove health data' }); }
});

module.exports = router;
