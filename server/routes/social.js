const express = require('express');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Settings = require('../models/Settings');
const Share = require('../models/Share');
const Block = require('../models/Block');
const WorkoutLog = require('../models/WorkoutLog');
const { requireAuth } = require('../middleware/auth');
const { localToday, shiftKey } = require('../services/dates');
const S = require('../services/social');

const router = express.Router();
router.use(requireAuth);

const searchLimit = S.rateLimit({ name: 'search', windowMs: 60_000, max: 30 });
const lookupLimit = S.rateLimit({ name: 'profile', windowMs: 60_000, max: 60 });
const blockLimit = S.rateLimit({ name: 'block', windowMs: 60_000, max: 20 });
const PAGE = 10;

async function computeStats(userId, today) {
  const logs = await WorkoutLog.find({ user: userId, date: { $gte: shiftKey(today, -400) } }).select('date').lean();
  const dates = new Set(logs.map((l) => l.date));
  const monthStart = today.slice(0, 8) + '01';
  const workoutsThisMonth = logs.filter((l) => l.date >= monthStart && l.date <= today).length;
  // Consecutive days with a workout, counting back from today (or yesterday if nothing yet today).
  let d = dates.has(today) ? today : shiftKey(today, -1);
  let streak = 0;
  while (dates.has(d)) { streak++; d = shiftKey(d, -1); }
  return { workoutsThisMonth, streak };
}

function ownView(user, prof) {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
    bio: prof.bio || '',
    discoverable: !!prof.discoverable,
    visibility: Object.fromEntries(Profile.FIELDS.map((f) => [f, !!(prof.visibility || {})[f]]))
  };
}

// GET /api/social/me – my profile & privacy settings
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('username displayName');
    res.json(ownView(user, await S.getProfile(req.session.userId)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load profile' }); }
});

// PUT /api/social/me – { bio, discoverable, visibility: { field: bool } }
router.put('/me', async (req, res) => {
  try {
    const b = req.body || {};
    const $set = { updatedAt: new Date() };
    if (b.bio != null) $set.bio = String(b.bio).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, 160);
    if (b.discoverable != null) $set.discoverable = b.discoverable === true;
    if (b.visibility && typeof b.visibility === 'object') {
      Profile.FIELDS.forEach((f) => { if (f in b.visibility) $set[`visibility.${f}`] = b.visibility[f] === true; });
    }
    const prof = await Profile.findOneAndUpdate({ user: req.session.userId }, { $set }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const user = await User.findById(req.session.userId).select('username displayName');
    res.json(ownView(user, prof));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save profile' }); }
});

// GET /api/social/profile/:username – 404 unless allowed (no hint whether the account exists)
router.get('/profile/:username', lookupLimit, async (req, res) => {
  try {
    const me = req.session.userId;
    const user = await S.findUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'Profile not found' });
    const prof = await S.getProfile(user._id);
    if (!(await S.canViewProfile(me, user._id, prof))) return res.status(404).json({ error: 'Profile not found' });
    const isSelf = S.same(me, user._id);
    const vis = prof.visibility || {};
    const out = { ...S.personCard(user, prof), isSelf };
    if (vis.bio && prof.bio) out.bio = prof.bio;
    if (vis.interests) {
      const st = await Settings.findOne({ user: user._id }).select('interests').lean();
      out.interests = ((st && st.interests) || []).slice(0, 30);
    }
    const stats = {};
    if (vis.workoutsThisMonth || vis.streak) {
      const s = await computeStats(user._id, localToday(req));
      if (vis.workoutsThisMonth) stats.workoutsThisMonth = s.workoutsThisMonth;
      if (vis.streak) stats.streak = s.streak;
    }
    if (vis.memberSince) stats.memberSince = (user.createdAt || new Date()).toISOString().slice(0, 7);
    out.stats = stats;
    if (!isSelf) {
      const [theirs, mine] = await Promise.all([S.shareFrom(user._id, me), S.shareFrom(me, user._id)]);
      out.relationship = {
        sharesWithMe: theirs ? S.PERM_KEYS.filter((k) => theirs.permissions && theirs.permissions[k]) : null,
        iShareWithThem: mine ? S.PERM_KEYS.filter((k) => mine.permissions && mine.permissions[k]) : null
      };
    }
    res.json(out);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load profile' }); }
});

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/social/search?q=ab&page=0 – discoverable users only, never self or blocked
router.get('/search', searchLimit, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 40);
    const page = Math.max(0, Math.min(50, parseInt(req.query.page, 10) || 0));
    if (q.length < 2) return res.status(400).json({ error: 'Type at least 2 characters' });
    const me = req.session.userId;
    const hidden = new Set([String(me), ...(await S.blockedIds(me))]);
    const discoverable = (await Profile.find({ discoverable: true }).select('user').lean())
      .map((p) => p.user).filter((id) => !hidden.has(String(id)));
    if (!discoverable.length) return res.json({ results: [], page, hasMore: false });
    const prefix = new RegExp('^' + escapeRe(q), 'i');
    const contains = new RegExp(escapeRe(q), 'i');
    const users = await User.find({ _id: { $in: discoverable }, $or: [{ username: contains }, { displayName: contains }] })
      .select('username displayName avatar').limit(500).lean();
    // Prefix matches first, then alphabetical.
    users.sort((a, b) => {
      const pa = prefix.test(a.username) || prefix.test(a.displayName || '') ? 0 : 1;
      const pb = prefix.test(b.username) || prefix.test(b.displayName || '') ? 0 : 1;
      return pa - pb || (a.displayName || a.username).localeCompare(b.displayName || b.username);
    });
    const slice = users.slice(page * PAGE, page * PAGE + PAGE);
    const profs = new Map((await Profile.find({ user: { $in: slice.map((u) => u._id) } }).lean()).map((p) => [String(p.user), p]));
    const results = slice.map((u) => {
      const p = profs.get(String(u._id)) || {};
      const card = S.personCard(u, p);
      if (p.visibility && p.visibility.bio && p.bio) card.bio = p.bio;
      return card;
    });
    res.json({ results, page, hasMore: users.length > (page + 1) * PAGE });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Search failed' }); }
});

// Blocks
router.get('/blocks', async (req, res) => {
  try {
    const rows = await Block.find({ blocker: req.session.userId }).populate('blocked', 'username displayName').sort({ createdAt: -1 }).lean();
    res.json(rows.filter((r) => r.blocked).map((r) => ({ username: r.blocked.username, displayName: r.blocked.displayName || r.blocked.username, since: r.createdAt })));
  } catch (err) { res.status(500).json({ error: 'Failed to load blocked people' }); }
});
// POST /api/social/blocks { username } – also removes shares in both directions (hides their comments)
router.post('/blocks', blockLimit, async (req, res) => {
  try {
    const me = req.session.userId;
    const user = await S.findUserByUsername(req.body && req.body.username);
    if (!user || S.same(user._id, me)) return res.status(404).json({ error: 'Person not found' });
    await Block.updateOne({ blocker: me, blocked: user._id }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    const removed = await Share.deleteMany({ $or: [{ owner: me, viewer: user._id }, { owner: user._id, viewer: me }] });
    res.json({ ok: true, sharesRemoved: removed.deletedCount });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to block' }); }
});
router.delete('/blocks/:username', blockLimit, async (req, res) => {
  try {
    const user = await S.findUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'Person not found' });
    await Block.deleteOne({ blocker: req.session.userId, blocked: user._id });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Failed to unblock' }); }
});

module.exports = router;
