// Parent links between an adult (18+) and a teen (13-17). Either side can ask;
// the other side accepts. Up to 2 parents per teen. Either side can unlink.
const express = require('express');
const ParentLink = require('../models/ParentLink');
const Share = require('../models/Share');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { requireAuth } = require('../middleware/auth');
const { localToday } = require('../services/dates');
const S = require('../services/social');
const F = require('../services/family');

const router = express.Router();
router.use(requireAuth);
const requestLimit = S.rateLimit({ name: 'family-req', windowMs: 60_000, max: 10 });
const requestDayLimit = S.rateLimit({ name: 'family-req-day', windowMs: 86_400_000, max: 30 });
const PENDING_TTL_MS = 14 * 86_400_000;
const MAX_OUTGOING = 10;
const MAX_INCOMING = 5;
const SENT = 'Request sent. It will show up for them if their account can be linked.';

async function people(ids) {
  const users = await User.find({ _id: { $in: ids.filter(Boolean) } }).select('username displayName avatar').lean();
  const profs = new Map((await Profile.find({ user: { $in: users.map((u) => u._id) } }).select('user visibility').lean()).map((p) => [String(p.user), p]));
  return new Map(users.map((u) => [String(u._id), S.personCard(u, profs.get(String(u._id)))]));
}

// GET /api/family – my role, links and requests
router.get('/', async (req, res) => {
  try {
    const me = req.session.userId;
    const today = localToday(req);
    const role = await F.groupOf(me, today);
    await ParentLink.deleteMany({ status: 'pending', createdAt: { $lt: new Date(Date.now() - PENDING_TTL_MS) } });
    const active = await F.activeLinks(me, today);
    const pending = await ParentLink.find({ status: 'pending', $or: [{ requestedBy: me }, { valid: true, parent: me }, { valid: true, teen: me }] }).sort({ createdAt: -1 }).lean();
    const ppl = await people([...active, ...pending].flatMap((l) => [l.parent, l.teen]));
    const other = (l) => (S.same(l.parent, me) ? l.teen : l.parent);
    const card = (l) => ppl.get(String(other(l))) || null;
    res.json({
      role,
      maxParents: F.MAX_PARENTS,
      parents: active.filter((l) => S.same(l.teen, me)).map((l) => ({ id: String(l._id), person: card(l), since: l.respondedAt || l.createdAt })),
      teens: active.filter((l) => S.same(l.parent, me)).map((l) => ({ id: String(l._id), person: card(l), since: l.respondedAt || l.createdAt })),
      incoming: pending.filter((l) => !S.same(l.requestedBy, me)).map((l) => ({ id: String(l._id), person: card(l), as: S.same(l.parent, me) ? 'parent' : 'teen', createdAt: l.createdAt })),
      // Outgoing requests look the same whether or not the username could be linked.
      outgoing: pending.filter((l) => S.same(l.requestedBy, me)).map((l) => ({ id: String(l._id), username: l.targetName, createdAt: l.createdAt }))
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load family links' }); }
});

// POST /api/family/requests { username } – adult -> teen ("I'm their parent") or teen -> adult ("this is my parent")
router.post('/requests', requestLimit, requestDayLimit, async (req, res) => {
  try {
    const me = req.session.userId;
    const today = localToday(req);
    const myRole = await F.groupOf(me, today);
    if (myRole !== 'adult' && myRole !== 'teen') return res.status(403).json({ error: 'Parent links are not available for this account' });
    const raw = String((req.body && req.body.username) || '').trim().replace(/^@/, '');
    if (!raw || raw.length > 40) return res.status(400).json({ error: 'Enter a username' });
    const outCount = await ParentLink.countDocuments({ requestedBy: me, status: 'pending' });
    if (outCount >= MAX_OUTGOING) return res.status(429).json({ error: 'You have too many pending requests. Cancel some first.' });
    if (myRole === 'teen') {
      const n = await ParentLink.countDocuments({ teen: me, status: 'active', valid: true });
      if (n >= F.MAX_PARENTS) return res.status(409).json({ error: `You already have ${F.MAX_PARENTS} linked parents` });
    }
    const target = await S.findUserByUsername(raw);
    if (target && S.same(target._id, me)) return res.status(400).json({ error: "That's your own username" });
    const targetName = target ? target.username : raw;
    // Same response for every outcome below, so requests can't be used to learn who is a teen.
    const dupe = await ParentLink.findOne({ requestedBy: me, targetName: new RegExp('^' + targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }).lean();
    if (dupe) return res.status(201).json({ ok: true, message: SENT });
    let valid = false, parent = null, teen = null;
    if (target && !(await S.isBlockedEither(me, target._id))) {
      const theirRole = await F.groupOf(target._id, today);
      if (myRole === 'adult' && theirRole === 'teen') { parent = me; teen = target._id; }
      if (myRole === 'teen' && theirRole === 'adult') { parent = target._id; teen = me; }
      if (parent) {
        const exists = await ParentLink.exists({ parent, teen, valid: true });
        const incoming = await ParentLink.countDocuments({ status: 'pending', valid: true, ...(myRole === 'adult' ? { teen } : { parent }), requestedBy: { $ne: myRole === 'adult' ? teen : parent } });
        const full = await ParentLink.countDocuments({ teen, status: 'active', valid: true });
        valid = !exists && incoming < MAX_INCOMING && full < F.MAX_PARENTS;
      }
    }
    await ParentLink.create({ parent: valid ? parent : null, teen: valid ? teen : null, requestedBy: me, targetName, valid });
    res.status(201).json({ ok: true, message: SENT });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to send request' }); }
});

async function loadIncoming(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) { res.status(404).json({ error: 'Request not found' }); return null; }
  const me = req.session.userId;
  const l = await ParentLink.findOne({ _id: req.params.id, status: 'pending', valid: true, requestedBy: { $ne: me }, $or: [{ parent: me }, { teen: me }] });
  if (!l) { res.status(404).json({ error: 'Request not found' }); return null; }
  return l;
}

// POST /api/family/:id/accept – the person who received the request accepts
router.post('/:id/accept', async (req, res) => {
  try {
    const l = await loadIncoming(req, res);
    if (!l) return;
    const today = localToday(req);
    const [gp, gt] = await F.groupsOf([l.parent, l.teen], today);
    if (gp !== 'adult' || gt !== 'teen' || (await S.isBlockedEither(l.parent, l.teen))) {
      await l.deleteOne();
      return res.status(409).json({ error: "This link can't be made (parent links are between an adult and a teen)" });
    }
    const n = await ParentLink.countDocuments({ teen: l.teen, status: 'active', valid: true });
    if (n >= F.MAX_PARENTS) return res.status(409).json({ error: `A teen account can have up to ${F.MAX_PARENTS} linked parents` });
    l.status = 'active'; l.respondedAt = new Date();
    await l.save();
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to accept' }); }
});

// POST /api/family/:id/decline
router.post('/:id/decline', async (req, res) => {
  try {
    const l = await loadIncoming(req, res);
    if (!l) return;
    await l.deleteOne();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Failed to decline' }); }
});

// DELETE /api/family/:id – cancel my request, or unlink (either side). Unlinking removes Share Access both ways.
router.delete('/:id', async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const me = req.session.userId;
    const l = await ParentLink.findOne({ _id: req.params.id, $or: [{ requestedBy: me }, { valid: true, parent: me }, { valid: true, teen: me }] });
    if (!l) return res.status(404).json({ error: 'Not found' });
    if (l.status === 'pending' && !S.same(l.requestedBy, me)) return res.status(400).json({ error: 'Use decline for requests you received' });
    await l.deleteOne();
    let sharesRemoved = 0;
    if (l.status === 'active') {
      const r = await Share.deleteMany({ $or: [{ owner: l.parent, viewer: l.teen }, { owner: l.teen, viewer: l.parent }] });
      sharesRemoved = r.deletedCount;
    }
    res.json({ ok: true, sharesRemoved });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to remove' }); }
});

module.exports = router;
