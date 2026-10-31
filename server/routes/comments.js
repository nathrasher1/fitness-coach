const express = require('express');
const Comment = require('../models/Comment');
const Profile = require('../models/Profile');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const { requireAuth } = require('../middleware/auth');
const { isDateKey } = require('../services/dates');
const S = require('../services/social');
const C = require('../services/comments');

const router = express.Router();
router.use(requireAuth);
const postLimit = S.rateLimit({ name: 'comment', windowMs: 60_000, max: 10 });
const dayLimit = S.rateLimit({ name: 'comment-day', windowMs: 86_400_000, max: 200 });
const readLimit = S.rateLimit({ name: 'comment-read', windowMs: 60_000, max: 120 });
const MAX = 500;

// Resolve ?owner=<username|me>&workout=<id> | &date=YYYY-MM-DD into a target the caller may access.
async function resolveTarget(req, src) {
  const me = req.session.userId;
  const ownerName = String(src.owner || 'me');
  const owner = ownerName === 'me' ? await User.findById(me).select('username displayName') : await S.findUserByUsername(ownerName);
  if (!owner) return null;
  let kind, workout = null, date = null;
  if (src.workout) {
    kind = 'workout';
    workout = await C.workoutOf(owner._id, src.workout);
    if (!workout) return null;
  } else if (isDateKey(String(src.date || ''))) {
    kind = 'day'; date = String(src.date);
  } else return null;
  if (!(await C.canAccess(me, owner._id, kind))) return null;
  return { owner, kind, workout, date };
}

function present(c, me, ownerId, people) {
  const a = people.get(String(c.author)) || {};
  return {
    id: String(c._id),
    text: c.text,
    createdAt: c.createdAt,
    author: { username: a.username, displayName: a.displayName || a.username, avatar: a.avatar || '' },
    mine: S.same(c.author, me),
    canDelete: S.same(c.author, me) || S.same(ownerId, me)
  };
}
async function peopleMap(ids) {
  const users = await User.find({ _id: { $in: ids } }).select('username displayName avatar').lean();
  const profs = new Map((await Profile.find({ user: { $in: ids } }).select('user visibility').lean()).map((p) => [String(p.user), p]));
  return new Map(users.map((u) => [String(u._id), S.personCard(u, profs.get(String(u._id)))]));
}

// GET /api/comments?owner=me|username&workout=id | &date=YYYY-MM-DD
router.get('/', readLimit, async (req, res) => {
  try {
    const t = await resolveTarget(req, req.query);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const authors = (await C.visibleAuthors(t.owner._id, t.kind, req.session.userId)).map(S.oid);
    const q = { owner: t.owner._id, author: { $in: authors }, ...(t.workout ? { workout: t.workout._id } : { workout: null, date: t.date }) };
    const rows = await Comment.find(q).sort({ createdAt: 1 }).limit(200).lean();
    const people = await peopleMap([...new Set(rows.map((r) => String(r.author)))]);
    res.json({ comments: rows.map((c) => present(c, req.session.userId, t.owner._id, people)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load comments' }); }
});

// GET /api/comments/counts?owner=me|username&workouts=id,id
router.get('/counts', readLimit, async (req, res) => {
  try {
    const me = req.session.userId;
    const ownerName = String(req.query.owner || 'me');
    const owner = ownerName === 'me' ? { _id: me } : await S.findUserByUsername(ownerName);
    if (!owner || !(await C.canAccess(me, owner._id, 'workout'))) return res.status(404).json({ error: 'Not found' });
    const ids = String(req.query.workouts || '').split(',').filter((x) => /^[a-f0-9]{24}$/i.test(x)).slice(0, 100);
    res.json(await C.countsFor(owner._id, ids, me));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to count comments' }); }
});

// POST /api/comments { owner, workout | date, text }
router.post('/', postLimit, dayLimit, async (req, res) => {
  try {
    const text = String((req.body && req.body.text) || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    if (!text) return res.status(400).json({ error: 'Write something first' });
    if (text.length > MAX) return res.status(400).json({ error: `Comments can be up to ${MAX} characters` });
    const t = await resolveTarget(req, req.body || {});
    if (!t) return res.status(404).json({ error: 'Not found' });
    const c = await Comment.create({ owner: t.owner._id, author: req.session.userId, workout: t.workout ? t.workout._id : null, date: t.workout ? null : t.date, text });
    const people = await peopleMap([req.session.userId]);
    res.status(201).json(present(c.toObject(), req.session.userId, t.owner._id, people));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to post comment' }); }
});

// DELETE /api/comments/:id – author or the owner of the thing commented on
router.delete('/:id', async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const me = req.session.userId;
    const r = await Comment.deleteOne({ _id: req.params.id, $or: [{ author: me }, { owner: me }] });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete comment' }); }
});

// GET /api/comments/unread – new comments by others on my things, or replies in threads I joined
router.get('/unread', readLimit, async (req, res) => {
  try {
    const me = req.session.userId;
    const prof = await S.getProfile(me);
    const since = prof.commentsSeenAt || new Date(0);
    const mine = await Comment.find({ author: me }).sort({ createdAt: -1 }).limit(200).select('owner workout date').lean();
    const threads = new Map();
    mine.forEach((c) => { if (!S.same(c.owner, me)) threads.set(`${c.owner}|${c.workout || ''}|${c.date || ''}`, { owner: c.owner, workout: c.workout, date: c.workout ? null : c.date }); });
    const or = [{ owner: S.oid(me) }, ...[...threads.values()]];
    const rows = await Comment.find({ author: { $ne: me }, createdAt: { $gt: since }, $or: or }).sort({ createdAt: -1 }).limit(100).lean();
    // Keep only comments the caller can still see.
    const cache = new Map();
    const visible = [];
    for (const c of rows) {
      const kind = c.workout ? 'workout' : 'day';
      const key = `${c.owner}|${kind}`;
      if (!cache.has(key)) {
        const access = await C.canAccess(me, c.owner, kind);
        cache.set(key, access ? new Set(await C.visibleAuthors(c.owner, kind, me)) : new Set());
      }
      if (cache.get(key).has(String(c.author))) visible.push(c);
    }
    const ids = [...new Set(visible.flatMap((c) => [String(c.author), String(c.owner)]))];
    const people = await peopleMap(ids);
    const wos = new Map((await WorkoutLog.find({ _id: { $in: visible.filter((c) => c.workout).map((c) => c.workout) } }).select('name date').lean()).map((w) => [String(w._id), w]));
    res.json({
      count: visible.length,
      items: visible.slice(0, 20).map((c) => {
        const w = c.workout && wos.get(String(c.workout));
        const o = people.get(String(c.owner)) || {};
        return {
          ...present(c, me, c.owner, people),
          owner: { username: o.username, displayName: o.displayName },
          onMine: S.same(c.owner, me),
          workout: w ? { id: String(w._id), name: w.name, date: w.date } : null,
          date: c.workout ? (w && w.date) || null : c.date
        };
      })
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load notifications' }); }
});

router.post('/seen', async (req, res) => {
  try {
    await Profile.updateOne({ user: req.session.userId }, { $set: { commentsSeenAt: new Date() } }, { upsert: true, setDefaultsOnInsert: true });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
