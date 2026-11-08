const mongoose = require('mongoose');

// Manual sport / practice session (complements imported HealthWorkout).
const sportSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // local YYYY-MM-DD
  sport: { type: String, required: true, maxlength: 80 },
  durationMin: { type: Number, required: true, min: 1, max: 600 },
  effort: { type: Number, required: true, min: 1, max: 10 },
  trainingLoad: { type: Number, min: 0, default: null },
  activeKcal: { type: Number, min: 0, default: null }, // MET estimate
  notes: { type: String, default: '', maxlength: 500 },
  drills: { type: String, default: '', maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
sportSessionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('SportSession', sportSessionSchema);
