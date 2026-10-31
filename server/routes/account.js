// Account-level actions that stay available even while an account is locked.
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { revokeUserSessions } = require('../services/sessions');
const { rateLimit } = require('../services/social');

const router = express.Router();
router.use(requireAuth);
const deleteLimit = rateLimit({ name: 'account-delete', windowMs: 15 * 60_000, max: 5 });

// DELETE /api/account { password } – delete the account and everything it owns.
router.delete('/', deleteLimit, async (req, res) => {
  try {
    const id = req.session.userId;
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    if (!password || !(await user.verifyPassword(password))) return res.status(403).json({ error: 'Password is incorrect' });
    const uid = user._id;
    for (const name of mongoose.modelNames()) {
      if (name === 'User') continue;
      const M = mongoose.model(name);
      const paths = ['user', 'owner', 'viewer', 'author', 'blocker', 'blocked', 'parent', 'teen', 'requestedBy'].filter((p) => M.schema.path(p));
      if (paths.length) await M.deleteMany({ $or: paths.map((p) => ({ [p]: uid })) });
    }
    await User.deleteOne({ _id: uid });
    await revokeUserSessions(uid);
    req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ ok: true }); });
  } catch (err) {
    console.error('Delete account error:', err && err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
