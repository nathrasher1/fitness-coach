const express = require('express');
const Share = require('../models/Share');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { isBlockedEither } = require('../services/social');
const F = require('../services/family');
const { localToday } = require('../services/dates');

const router = express.Router();
const PERM_KEYS = ['weight', 'food', 'workouts', 'body', 'goals'];
// Only the public identity fields. Email is never returned: sharing by username
// must not reveal someone's address, and viewers never see the owner's.
const PERSON = 'username displayName';

function cleanPerms(p) {
  const out = {};
  if (p && typeof p === 'object') PERM_KEYS.forEach((k) => { if (k in p) out[k] = p[k] === true; });
  return out;
}

// Find the person by username (case-insensitive). Emails are private, so they
// can't be used to look someone up (that would reveal whether an address has an account).
async function findViewer(raw) {
  const q = String(raw || '').trim().replace(/^@/, '');
  if (!q || q.length > 40 || q.includes('@')) return null;
  const matches = await User.findUsernameCandidates(q);
  return matches[0] || null;
}
const TEEN_SHARE = 'On teen accounts, Share Access works only with a linked parent.';
router.use(requireAuth);

// GET /api/shares — shares I have granted + shares I have received
router.get('/', async (req, res) => {
  try {
    const today = localToday(req);
    const me = req.session.userId;
    const granted = await Share.find({ owner: me }).populate('viewer', PERSON).sort({ createdAt: -1 }).lean();
    const received = await Share.find({ viewer: me }).populate('owner', PERSON).sort({ createdAt: -1 }).lean();
    // "paused": the share exists but the age rules don't allow it right now
    // (e.g. the other person hasn't confirmed their date of birth yet).
    const mark = async (rows, key) => Promise.all(rows.map(async (r) => ({ ...r, paused: !r[key] || !(await F.canConnect(me, r[key]._id, today)) })));
    res.json({ granted: await mark(granted, 'viewer'), received: await mark(received, 'owner'), ageGroup: await F.groupOf(me, today) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load shares' });
  }
});

// POST /api/shares — grant access by email
router.post('/', async (req, res) => {
  try {
    const { email, note } = req.body;
    const permissions = cleanPerms(req.body.permissions);
    const cleanNote = note == null ? null : String(note).trim().slice(0, 120);
    const who = req.body.username != null ? req.body.username : email;
    if (!who || !String(who).trim()) return res.status(400).json({ error: 'Username required' });
    const today = localToday(req);
    const myGroup = await F.groupOf(req.session.userId, today);

    const viewer = await findViewer(who);
    // Blocked either way looks the same as "no account" so a block is not revealed.
    if (viewer && viewer._id.equals(req.session.userId)) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }
    // Teens: only with a linked parent. Adults: not with a teen unless linked (looks like "no account").
    if (myGroup === 'teen' && !(viewer && (await F.isLinked(viewer._id, req.session.userId)))) return res.status(403).json({ error: TEEN_SHARE, code: 'teen_limit' });
    if (!viewer || (await isBlockedEither(req.session.userId, viewer._id)) || !(await F.canConnect(req.session.userId, viewer._id, today))) return res.status(404).json({ error: 'No account found with that username' });

    const existing = await Share.findOne({ owner: req.session.userId, viewer: viewer._id });
    if (existing) {
      existing.permissions = { ...existing.permissions.toObject(), ...permissions };
      if (cleanNote != null) existing.note = cleanNote;
      await existing.save();
      await existing.populate('viewer', PERSON);
      return res.json(existing);
    }

    const share = await Share.create({
      owner: req.session.userId,
      viewer: viewer._id,
      permissions,
      note: cleanNote || ''
    });
    await share.populate('viewer', PERSON);
    res.status(201).json(share);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create share' });
  }
});

// DELETE /api/shares/:id — the owner revokes, or the viewer removes a share they received
router.delete('/:id', async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found or not owner' });
    const me = req.session.userId;
    const result = await Share.deleteOne({ _id: req.params.id, $or: [{ owner: me }, { viewer: me }] });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found or not owner' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke' });
  }
});

module.exports = router;
