const express = require('express');
const User = require('../models/User');
const ProgressPhoto = require('../models/ProgressPhoto');
const { requireAuth } = require('../middleware/auth');

const { localToday, daysAgoKey, shiftKey, isDateKey } = require('../services/dates');
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
    // Optional filters: ?date=YYYY-MM-DD (one diary day) or ?from=&to= (a month).
    // ?meta=1 leaves out the image data so the calendar can mark photo days cheaply.
    const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const q = { user: req.session.userId };
    if (isDay(req.query.date)) q.date = req.query.date;
    else if (isDay(req.query.from) || isDay(req.query.to)) {
      q.date = {};
      if (isDay(req.query.from)) q.date.$gte = req.query.from;
      if (isDay(req.query.to)) q.date.$lte = req.query.to;
    }
    const filtered = q.date != null;
    let find = ProgressPhoto.find(q).sort({ date: -1, createdAt: -1 }).limit(filtered ? 100 : 30);
    if (req.query.meta === '1') find = find.select('date note createdAt');
    res.json(await find);
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
      date: req.body.date || localToday(req),
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
