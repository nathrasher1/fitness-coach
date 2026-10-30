const mongoose = require('mongoose');

const setSchema = new mongoose.Schema({
  reps: { type: Number, min: 0 },
  weight: { type: Number, min: 0 }, // stored in lbs
  rpe: { type: Number, min: 1, max: 10 },
  distanceM: { type: Number, min: 0 },
  durationSec: { type: Number, min: 0 },
  note: { type: String, default: '' },
  // 'working' (default, also for sets logged before set types existed), 'warmup', 'failure'
  type: { type: String, enum: ['working', 'warmup', 'failure'], default: 'working' }
}, { _id: false });

const workoutExerciseSchema = new mongoose.Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
  exerciseName: { type: String, required: true },
  equipment: { type: String, default: '' },
  restSec: { type: Number, min: 0, max: 900 },
  sets: [setSchema]
}, { _id: false });

const workoutLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true },
  name: { type: String, default: 'Workout' },
  notes: { type: String, default: '' },
  durationMin: { type: Number, min: 0 },
  // Optional link to the plan day this session came from, e.g. "full_body_3day:Day A" or "routine:<id>"
  planDay: { type: String, default: '' },
  exercises: [workoutExerciseSchema],
  createdAt: { type: Date, default: Date.now }
});

workoutLogSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('WorkoutLog', workoutLogSchema);
