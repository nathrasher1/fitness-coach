const mongoose = require('mongoose');

// A holiday / flex day. Optional rough intake estimate; never required.
const flexDaySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // local YYYY-MM-DD
  label: { type: String, default: '' }, // e.g. "Thanksgiving" or custom note
  holidayKey: { type: String, default: '' }, // preset key when chosen from list
  estimate: { type: String, enum: ['none', 'light', 'moderate', 'feast'], default: 'none' },
  addKcal: { type: Number, min: 0, max: 10000, default: 0 }, // rough surplus over target
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
flexDaySchema.index({ user: 1, date: 1 }, { unique: true });
flexDaySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('FlexDay', flexDaySchema);
