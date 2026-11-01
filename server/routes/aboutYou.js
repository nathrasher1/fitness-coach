// Private "About you" answers (all optional). GET/PUT /api/about-you, POST /api/about-you/dismiss.
// Mounted after the account gate, so under-13 locked accounts never reach it.
const express = require('express');
const AboutYou = require('../models/AboutYou');
const User = require('../models/User');
const Goal = require('../models/Goal');
const Weight = require('../models/Weight');
const { requireAuth } = require('../middleware/auth');
const { localToday } = require('../services/dates');
const { userGroup } = require('../services/age');
const { targetPolicy } = require('../services/recommendations');
const Q = require('../../client/lib/aboutYou');
const TH = require('../services/teenHealth');
const ParentLink = require('../models/ParentLink');

const router = express.Router();
router.use(requireAuth);

const one = (v, list) => (typeof v === 'string' && Q.values(list).includes(v) ? v : '');
const many = (v, list) => (Array.isArray(v) ? [...new Set(v.filter((x) => Q.values(list).includes(x)))] : []);

function view(doc, group) {
  const a = doc || {};
  const filled = !!a.savedAt;
  return {
    answers: {
      goal: a.goal || '', sex: a.sex || '', heightCm: a.heightCm || null, experience: a.experience || '',
      activity: a.activity || '', equipment: a.equipment || [], easyOn: a.easyOn || [], diet: a.diet || [], avoid: a.avoid || []
    },
    filled,
    showHomeCard: !filled && !a.dismissedAt,
    group,
    policy: targetPolicy(group)
  };
}
async function groupFor(req) {
  const user = await User.findById(req.session.userId).select('+dob accountLocked');
  return userGroup(user, localToday(req));
}

router.get('/', async (req, res) => {
  try {
    const [doc, group] = await Promise.all([AboutYou.findOne({ user: req.session.userId }).lean(), groupFor(req)]);
    res.json(view(doc, group));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load your answers' });
  }
});

router.put('/', async (req, res) => {
  try {
    const b = req.body || {};
    const group = await groupFor(req);
    const update = {
      goal: one(b.goal, Q.GOALS), sex: one(b.sex, Q.SEX), experience: one(b.experience, Q.EXPERIENCE),
      activity: one(b.activity, Q.ACTIVITY), equipment: many(b.equipment, Q.EQUIPMENT), easyOn: many(b.easyOn, Q.EASY_ON),
      diet: many(b.diet, Q.DIET), avoid: many(b.avoid, Q.AVOID), savedAt: new Date(), updatedAt: new Date()
    };
    const unset = {};
    const h = Number(b.heightCm);
    if (b.heightCm != null && b.heightCm !== '' && !(h >= 100 && h <= 250)) return res.status(400).json({ error: 'Enter a height between 100 and 250 cm (3 ft 4 in – 8 ft 2 in)' });
    if (h >= 100 && h <= 250) update.heightCm = Math.round(h * 10) / 10; else unset.heightCm = 1;
    const w = Number(b.weightLbs);
    if (b.weightLbs != null && b.weightLbs !== '' && !(w >= 50 && w <= 700)) return res.status(400).json({ error: 'Enter a realistic weight' });

    const doc = await AboutYou.findOneAndUpdate(
      { user: req.session.userId },
      Object.keys(unset).length ? { $set: update, $unset: unset } : { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    // Body basics also feed the existing places that use them.
    if (update.heightCm) await User.updateOne({ _id: req.session.userId }, { $set: { heightCm: update.heightCm } });
    if (w >= 50 && w <= 700) {
      await Weight.findOneAndUpdate({ user: req.session.userId, date: localToday(req) }, { $set: { weight: Math.round(w * 10) / 10 }, $setOnInsert: { note: '' } }, { upsert: true, setDefaultsOnInsert: true });
    }
    // Goal answer sets the Goal type only if the user hasn't set up a goal yet (never overwrites one).
    if (update.goal) {
      let type = (Q.GOALS.find((g) => g[0] === update.goal)[2] || {}).goalType || 'maintain';
      if (type === 'lose' && !targetPolicy(group).allowDeficit) type = 'maintain';
      const existing = await Goal.findOne({ user: req.session.userId });
      if (!existing) await Goal.create({ user: req.session.userId, type });
      else if (existing.type === 'maintain' && !existing.amountLbs && !existing.targetDate && type !== 'maintain') {
        existing.type = type; existing.updatedAt = new Date(); await existing.save();
      }
    }
    res.json(view(doc, group));
  } catch (err) {
    console.error('About you save error:', err && err.message);
    res.status(500).json({ error: 'Failed to save your answers' });
  }
});

// Teen habit support. Only says flagged/not; the BMI and percentile are never returned.
router.get('/teen-support', async (req, res) => {
  try {
    const today = localToday(req);
    const st = await TH.teenStatus(req.session.userId, today);
    if (st.group !== 'teen') return res.json({ teen: false, flagged: false });
    const parents = await ParentLink.countDocuments({ teen: req.session.userId, status: 'active', valid: true });
    const base = { teen: true, flagged: st.flagged, parentsLinked: parents, shareBody: st.shareBody,
      parentSees: parents && st.flagged ? TH.CONTENT.parentSees : [], privateUnlessShared: TH.CONTENT.privateUnlessShared, alwaysPrivate: TH.CONTENT.alwaysPrivate };
    if (!st.flagged) return res.json(base);
    res.json({ ...base, note: TH.CONTENT.note, noParentNote: parents ? '' : TH.CONTENT.noParentNote, habits: TH.CONTENT.habits, suggestions: TH.CONTENT.suggestions, cutBack: TH.CONTENT.cutBack });
  } catch (err) { res.status(500).json({ error: 'Failed to load' }); }
});

// Teen toggle: share weight, BMI, measurements and photos with linked parents (default off).
router.put('/share-body', async (req, res) => {
  try {
    if ((await groupFor(req)) !== 'teen') return res.status(400).json({ error: 'Only for teen accounts' });
    const on = req.body && req.body.on === true;
    await AboutYou.findOneAndUpdate({ user: req.session.userId }, { $set: { shareBodyWithParent: on } }, { upsert: true, setDefaultsOnInsert: true });
    res.json({ shareBody: on });
  } catch (err) { res.status(500).json({ error: 'Failed to save' }); }
});

// Hide the one-time home card (Skip / ×). The Settings entry stays until the answers are saved.
router.post('/dismiss', async (req, res) => {
  try {
    const doc = await AboutYou.findOneAndUpdate({ user: req.session.userId }, { $set: { dismissedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    res.json(view(doc, await groupFor(req)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

module.exports = router;
