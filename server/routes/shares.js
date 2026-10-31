const express = require('express');
const Share = require('../models/Share');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { isBlockedEither } = require('../services/social');

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

// Find the person by email (contains @) or by username (case-insensitive).
async function findViewer(raw) {
  const q = String(raw || '').trim();
  if (!q || q.length > 120) return null;
  if (q.includes('@')) return User.findOne({ email: q.toLowerCase() });
  const matches = await User.findUsernameCandidates(q);
  return matches[0] || null;
}
router.use(requireAuth);

// GET /api/shares — shares I have granted + shares I have received
router.get('/', async (req, res) => {
  try {
    const granted = await Share.find({ owner: req.session.userId })
      .populate('viewer', PERSON)
      .sort({ createdAt: -1 });
    const received = await Share.find({ viewer: req.session.userId })
      .populate('owner', PERSON)
      .sort({ createdAt: -1 });
    res.json({ granted, received });
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
    if (!email || !String(email).trim()) return res.status(400).json({ error: 'Email or username required' });

    const viewer = await findViewer(email);
    // Blocked either way looks the same as "no account" so a block is not revealed.
    if (!viewer || (await isBlockedEither(req.session.userId, viewer._id))) return res.status(404).json({ error: 'No account found with that email or username' });
    if (viewer._id.equals(req.session.userId)) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

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
