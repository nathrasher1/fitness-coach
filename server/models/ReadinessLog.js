const mongoose = require('mongoose');

// Optional daily readiness check-in. Scales are 1–5. A missing day stays blank, never zero.
const readinessLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // local YYYY-MM-DD
  sleep: { type: Number, min: 1, max: 5, default: null },
  soreness: { type: Number, min: 1, max: 5, default: null },
  mood: { type: Number, min: 1, max: 5, default: null },
  energy: { type: Number, min: 1, max: 5, default: null },
  notes: { type: String, default: '', maxlength: 300 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
readinessLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ReadinessLog', readinessLogSchema);
