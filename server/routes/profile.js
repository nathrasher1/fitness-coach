const express = require('express');
const User = require('../models/User');
const ProgressPhoto = require('../models/ProgressPhoto');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.put('/avatar', async (req, res) => {
  try {
    const avatar = String(req.body.avatar || '');
    if (avatar.length > 2_000_000) {
      return res.status(400).json({ error: 'Photo is too large' });
    }
    const user = await User.findByIdAndUpdate(
      req.session.userId,
      { avatar },
      { new: true }
    );
    res.json({ avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save avatar' });
  }
});

router.get('/photos', async (req, res) => {
  try {
    const photos = await ProgressPhoto.find({ user: req.session.userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(30);
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load photos' });
  }
});

router.post('/photos', async (req, res) => {
  try {
    const image = String(req.body.image || '');
    if (!image) return res.status(400).json({ error: 'image required' });
    if (image.length > 2_000_000) return res.status(400).json({ error: 'Photo is too large' });
    const photo = await ProgressPhoto.create({
      user: req.session.userId,
      date: req.body.date || new Date().toISOString().slice(0, 10),
      image,
      note: req.body.note || ''
    });
    res.status(201).json(photo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save photo' });
  }
});

router.delete('/photos/:id', async (req, res) => {
  try {
    const result = await ProgressPhoto.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
