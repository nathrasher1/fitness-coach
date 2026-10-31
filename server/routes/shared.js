// Read-only access to data someone has shared with the caller via Share Access.
// Every endpoint re-checks the Share row and the specific permission.
const express = require('express');
const Share = require('../models/Share');
const Profile = require('../models/Profile');
const Weight = require('../models/Weight');
const WorkoutLog = require('../models/WorkoutLog');
const FoodLog = require('../models/FoodLog');
const BodyMetric = require('../models/BodyMetric');
const Goal = require('../models/Goal');
const { requireAuth } = require('../middleware/auth');
const { localToday, isDateKey, shiftKey } = require('../services/dates');
const S = require('../services/social');
const C = require('../services/comments');
const F = require('../services/family');

const router = express.Router();
router.use(requireAuth);
router.use(S.rateLimit({ name: 'shared', windowMs: 60_000, max: 120 }));

const perms = (p) => S.PERM_KEYS.filter((k) => p && p[k]);

// GET /api/shared – people sharing with me
router.get('/', async (req, res) => {
  try {
    const me = req.session.userId;
    const blocked = new Set(await S.blockedIds(me));
    const rows = await Share.find({ viewer: me }).populate('owner', 'username displayName avatar').sort({ createdAt: -1 }).lean();
    const today = localToday(req);
    const allowed = await Promise.all(rows.map((r) => (r.owner ? F.canConnect(me, r.owner._id, today) : false)));
    const list = rows.filter((r, i) => allowed[i] && r.owner && !blocked.has(String(r.owner._id)) && perms(r.permissions).length);
    const profs = new Map((await Profile.find({ user: { $in: list.map((r) => r.owner._id) } }).select('user visibility').lean()).map((p) => [String(p.user), p]));
    res.json(list.map((r) => ({ ...S.personCard(r.owner, profs.get(String(r.owner._id))), permissions: perms(r.permissions), note: r.note || '', since: r.createdAt })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load shared data' }); }
});

// Loads owner + Share for :username; 404 for anything not shared (no existence leaks).
router.use('/:username', async (req, res, next) => {
  try {
    const me = req.session.userId;
    const owner = await S.findUserByUsername(req.params.username);
    if (!owner || S.same(owner._id, me) || (await S.isBlockedEither(me, owner._id))) return res.status(404).json({ error: 'Nothing shared' });
    if (!(await F.canConnect(me, owner._id, localToday(req)))) return res.status(404).json({ error: 'Nothing shared' });
    const share = await S.shareFrom(owner._id, me);
    if (!share || !perms(share.permissions).length) return res.status(404).json({ error: 'Nothing shared' });
    req.sharedOwner = owner; req.share = share;
    next();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load shared data' }); }
});
const need = (perm) => (req, res, next) => (req.share.permissions && req.share.permissions[perm] ? next() : res.status(403).json({ error: 'Not shared with you' }));

router.get('/:username', async (req, res) => {
  const prof = await S.getProfile(req.sharedOwner._id);
  res.json({ ...S.personCard(req.sharedOwner, prof), permissions: perms(req.share.permissions), note: req.share.note || '' });
});

router.get('/:username/weights', need('weight'), async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, parseInt(req.query.days, 10) || 90));
    const from = shiftKey(localToday(req), -days);
    const rows = await Weight.find({ user: req.sharedOwner._id, date: { $gte: from } }).sort({ date: 1 }).select('date weight -_id').lean();
    res.json(rows.map((r) => ({ date: r.date, weight: r.weight })));
  } catch (err) { res.status(500).json({ error: 'Failed to load weights' }); }
});

function workoutOut(w) {
  return {
    id: String(w._id), name: w.name, date: w.date, durationMin: w.durationMin || null, notes: w.notes || '',
    exercises: (w.exercises || []).map((e) => ({
      exerciseName: e.exerciseName, equipment: e.equipment || '',
      sets: (e.sets || []).map((s) => ({ reps: s.reps ?? null, weight: s.weight ?? null, type: s.type || 'working', durationSec: s.durationSec ?? null, distanceM: s.distanceM ?? null }))
    }))
  };
}
router.get('/:username/workouts', need('workouts'), async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
    const q = { user: req.sharedOwner._id };
    if (isDateKey(String(req.query.before || ''))) q.date = { $lt: req.query.before };
    const rows = await WorkoutLog.find(q).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
    const counts = await C.countsFor(req.sharedOwner._id, rows.map((r) => r._id), req.session.userId, localToday(req));
    res.json(rows.map((w) => ({ ...workoutOut(w), comments: counts[String(w._id)] || 0 })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load workouts' }); }
});
router.get('/:username/workouts/:id', need('workouts'), async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const w = await WorkoutLog.findOne({ _id: req.params.id, user: req.sharedOwner._id }).lean();
    if (!w) return res.status(404).json({ error: 'Not found' });
    res.json(workoutOut(w));
  } catch (err) { res.status(500).json({ error: 'Failed to load workout' }); }
});

router.get('/:username/food', need('food'), async (req, res) => {
  try {
    const date = isDateKey(String(req.query.date || '')) ? req.query.date : localToday(req);
    const rows = await FoodLog.find({ user: req.sharedOwner._id, date }).sort({ createdAt: 1 }).lean();
    const logs = rows.map((r) => ({ meal: r.meal, foodName: r.foodName, servings: r.servings, amount: r.amount, amountUnit: r.amountUnit || '', calories: r.calories, protein: r.protein || 0, carbs: r.carbs || 0, fat: r.fat || 0 }));
    const totals = logs.reduce((t, l) => ({ calories: t.calories + l.calories, protein: t.protein + l.protein, carbs: t.carbs + l.carbs, fat: t.fat + l.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    res.json({ date, logs, totals });
  } catch (err) { res.status(500).json({ error: 'Failed to load food' }); }
});

const BODY_FIELDS = ['bodyFatPct', 'chestCm', 'shouldersCm', 'waistCm', 'hipsCm', 'leftArmCm', 'rightArmCm', 'leftThighCm', 'rightThighCm', 'leftCalfCm', 'rightCalfCm', 'neckCm'];
router.get('/:username/body', need('body'), async (req, res) => {
  try {
    const rows = await BodyMetric.find({ user: req.sharedOwner._id }).sort({ date: -1 }).limit(10).lean();
    res.json(rows.map((r) => ({ date: r.date, ...Object.fromEntries(BODY_FIELDS.filter((f) => r[f] != null).map((f) => [f, r[f]])) })));
  } catch (err) { res.status(500).json({ error: 'Failed to load measurements' }); }
});

router.get('/:username/goals', need('goals'), async (req, res) => {
  try {
    const g = await Goal.findOne({ user: req.sharedOwner._id }).lean();
    if (!g) return res.json(null);
    res.json({ type: g.type, amountLbs: g.amountLbs, weeks: g.weeks, targetDate: g.targetDate || '', proteinG: g.proteinG ?? null, carbsG: g.carbsG ?? null, fatG: g.fatG ?? null });
  } catch (err) { res.status(500).json({ error: 'Failed to load goals' }); }
});

module.exports = router;
