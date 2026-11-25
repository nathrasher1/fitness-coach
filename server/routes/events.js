const express = require('express');
const Event = require('../models/Event');
const Weight = require('../models/Weight');
const WorkoutLog = require('../models/WorkoutLog');
const SportSession = require('../models/SportSession');
const FoodLog = require('../models/FoodLog');
const FlexDay = require('../models/FlexDay');
const ReadinessLog = require('../models/ReadinessLog');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { localToday, isDateKey, shiftKey } = require('../services/dates');
const { userGroup } = require('../services/age');
const E = require('../services/events');
const WC = require('../services/weightClass');
const Recap = require('../services/eventRecap');
const R = require('../services/readiness');

const router = express.Router();
router.use(requireAuth);

function isId(id) {
  return /^[a-f0-9]{24}$/i.test(id);
}

async function ageGroupFor(req) {
  const user = await User.findById(req.session.userId).select('+dob accountLocked');
  return userGroup(user, localToday(req));
}

async function latestWeightLbs(userId, date) {
  const w = await Weight.findOne({ user: userId, date: { $lte: date } }).sort({ date: -1 }).select('weight').lean();
  return w && w.weight;
}

function view(doc, { today, plan } = {}) {
  const weighInDate = doc.weighInDate || doc.date;
  const out = {
    id: String(doc._id),
    name: doc.name,
    sport: doc.sport,
    type: doc.type,
    date: doc.date,
    time: doc.time || '',
    place: doc.place || '',
    notes: doc.notes || '',
    resultKind: doc.resultKind || 'generic',
    result: doc.result || null,
    hasResult: E.hasResult(doc.result),
    weightClassLbs: doc.weightClassLbs == null ? null : doc.weightClassLbs,
    weighInDate,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
  if (today) out.countdown = E.countdown(today, doc.date);
  if (plan) out.weightClassPlan = plan;
  return out;
}

async function attachPlan(req, doc, today) {
  if (!doc || !(doc.weightClassLbs > 0)) return view(doc, { today });
  const weigh = doc.weighInDate || doc.date;
  const [current, group] = await Promise.all([
    latestWeightLbs(req.session.userId, today),
    ageGroupFor(req)
  ]);
  const plan = WC.planWeightClass({
    currentWeightLbs: current,
    classLbs: doc.weightClassLbs,
    weighInDate: weigh,
    today,
    ageGroup: group
  });
  return view(doc, { today, plan: plan.ok ? plan : { ok: false, error: plan.error, status: 'error' } });
}

// GET /api/events/presets
router.get('/presets', (_req, res) => {
  res.json(E.presets());
});

// GET /api/events/upcoming
router.get('/upcoming', async (req, res) => {
  try {
    const today = localToday(req);
    const rows = await Event.find({ user: req.session.userId, date: { $gte: today } })
      .sort({ date: 1, time: 1, createdAt: 1 }).limit(8).lean();
    const upcoming = [];
    for (const row of rows) upcoming.push(await attachPlan(req, row, today));
    const readiness = await ReadinessLog.findOne({ user: req.session.userId, date: today }).lean();
    res.json({
      today,
      presets: E.presets(),
      upcoming,
      next: upcoming[0] || null,
      readinessToday: R.view(readiness)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load upcoming events' });
  }
});

// GET /api/events?from=&to=
router.get('/', async (req, res) => {
  try {
    const today = localToday(req);
    const to = isDateKey(req.query.to) ? req.query.to : shiftKey(today, 60);
    const from = isDateKey(req.query.from) ? req.query.from : shiftKey(today, -30);
    const rows = await Event.find({ user: req.session.userId, date: { $gte: from, $lte: to } })
      .sort({ date: 1, time: 1, createdAt: 1 }).limit(200).lean();
    const events = [];
    for (const row of rows) events.push(await attachPlan(req, row, today));
    res.json({ presets: E.presets(), events, today });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// GET /api/events/:id/recap  (before /:id)
router.get('/:id/recap', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const today = localToday(req);
    const event = await Event.findOne({ _id: req.params.id, user: req.session.userId }).lean();
    if (!event) return res.status(404).json({ error: 'Not found' });
    const from = shiftKey(event.date, -7);
    const to = event.date;
    const [others, workouts, sports, weights, foods, flexes, readiness] = await Promise.all([
      Event.find({ user: req.session.userId, date: { $lt: event.date } }).sort({ date: -1 }).limit(40).lean(),
      WorkoutLog.find({ user: req.session.userId, date: { $gte: from, $lte: to } }).lean(),
      SportSession.find({ user: req.session.userId, date: { $gte: from, $lte: to } }).lean(),
      Weight.find({ user: req.session.userId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean(),
      FoodLog.find({ user: req.session.userId, date: { $gte: from, $lte: to } }).select('date calories').lean(),
      FlexDay.find({ user: req.session.userId, date: { $gte: from, $lte: to } }).select('date estimateKcal').lean(),
      ReadinessLog.find({ user: req.session.userId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean()
    ]);
    const foodByDate = {};
    foods.forEach((l) => {
      foodByDate[l.date] = (foodByDate[l.date] || 0) + (Number(l.calories) || 0);
    });
    flexes.forEach((f) => {
      if (f.estimateKcal > 0) foodByDate[f.date] = (foodByDate[f.date] || 0) + f.estimateKcal;
    });
    const recap = Recap.buildRecap({
      event,
      others,
      workouts,
      sports,
      weights,
      foodByDate,
      readiness,
      today
    });
    const ev = await attachPlan(req, event, today);
    res.json({ event: ev, recap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load recap' });
  }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const today = localToday(req);
    const event = await Event.findOne({ _id: req.params.id, user: req.session.userId }).lean();
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json(await attachPlan(req, event, today));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load event' });
  }
});

// POST /api/events
router.post('/', async (req, res) => {
  try {
    const n = E.normalizeEvent(req.body || {});
    if (n.error) return res.status(400).json({ error: n.error });
    const doc = await Event.create({
      user: req.session.userId,
      name: n.name,
      sport: n.sport,
      type: n.type,
      date: n.date,
      time: n.time,
      place: n.place,
      notes: n.notes,
      resultKind: n.resultKind,
      weightClassLbs: n.weightClassLbs,
      weighInDate: n.weighInDate,
      updatedAt: new Date()
    });
    const today = localToday(req);
    res.status(201).json(await attachPlan(req, doc.toObject(), today));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

// PUT /api/events/:id
router.put('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const n = E.normalizeEvent(req.body || {});
    if (n.error) return res.status(400).json({ error: n.error });
    const doc = await Event.findOneAndUpdate(
      { _id: req.params.id, user: req.session.userId },
      {
        $set: {
          name: n.name,
          sport: n.sport,
          type: n.type,
          date: n.date,
          time: n.time,
          place: n.place,
          notes: n.notes,
          resultKind: n.resultKind,
          weightClassLbs: n.weightClassLbs,
          weighInDate: n.weighInDate,
          updatedAt: new Date()
        }
      },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(await attachPlan(req, doc, localToday(req)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// PUT /api/events/:id/result
router.put('/:id/result', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const existing = await Event.findOne({ _id: req.params.id, user: req.session.userId });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const kind = (req.body && req.body.kind) || existing.resultKind || 'generic';
    const result = E.normalizeResult(kind, req.body || {});
    existing.result = result;
    existing.resultKind = result.kind;
    existing.updatedAt = new Date();
    await existing.save();
    res.json(await attachPlan(req, existing.toObject(), localToday(req)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await Event.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
