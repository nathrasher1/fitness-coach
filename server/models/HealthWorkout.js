const mongoose = require('mongoose');

// An exercise session imported from a phone health platform (Health Connect /
// HealthKit). Deduplicated by the platform's own record id.
const healthWorkoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  source: { type: String, required: true },
  externalId: { type: String, required: true },
  date: { type: String, required: true }, // local day the session started
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  type: { type: String, default: 'other' },
  name: { type: String, default: 'Workout' },
  app: { type: String, default: '' }, // device/app that recorded it
  durationMin: { type: Number, min: 0, default: null },
  activeKcal: { type: Number, min: 0, default: null },
  distanceM: { type: Number, min: 0, default: null },
  updatedAt: { type: Date, default: Date.now }
});
healthWorkoutSchema.index({ user: 1, source: 1, externalId: 1 }, { unique: true });
healthWorkoutSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('HealthWorkout', healthWorkoutSchema);
