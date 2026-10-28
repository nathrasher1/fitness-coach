const express = require('express');
const Share = require('../models/Share');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/shares — shares I have granted + shares I have received
router.get('/', async (req, res) => {
  try {
    const granted = await Share.find({ owner: req.session.userId })
      .populate('viewer', 'name email')
      .sort({ createdAt: -1 });
    const received = await Share.find({ viewer: req.session.userId })
      .populate('owner', 'name email')
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
    const { email, permissions, note } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const viewer = await User.findOne({ email: email.toLowerCase().trim() });
    if (!viewer) return res.status(404).json({ error: 'No account found with that email' });
    if (viewer._id.equals(req.session.userId)) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

    const existing = await Share.findOne({ owner: req.session.userId, viewer: viewer._id });
    if (existing) {
      existing.permissions = { ...existing.permissions.toObject(), ...permissions };
      if (note != null) existing.note = note;
      await existing.save();
      return res.json(existing);
    }

    const share = await Share.create({
      owner: req.session.userId,
      viewer: viewer._id,
      permissions: permissions || {},
      note: note || ''
    });
    res.status(201).json(share);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create share' });
  }
});

// DELETE /api/shares/:id — revoke (only owner can delete)
router.delete('/:id', async (req, res) => {
  try {
    const result = await Share.deleteOne({ _id: req.params.id, owner: req.session.userId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found or not owner' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke' });
  }
});

module.exports = router;
