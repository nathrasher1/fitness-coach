const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  lift: { type: String, enum: ['squat', 'bench', 'deadlift', 'snatch', 'clean_and_jerk'], required: true },
  attempt: { type: Number, min: 1, max: 3, required: true },
  weightLbs: { type: Number, min: 0, max: 2000, default: null },
  outcome: { type: String, enum: ['good', 'no-lift', 'skip'], default: 'skip' }
}, { _id: false });

const splitSchema = new mongoose.Schema({
  label: { type: String, default: '', maxlength: 40 },
  timeSec: { type: Number, min: 0, default: null }
}, { _id: false });

const resultSchema = new mongoose.Schema({
  kind: { type: String, enum: ['generic', 'lifting', 'race', 'match'], default: 'generic' },
  place: { type: String, default: '', maxlength: 40 },
  outcome: { type: String, enum: ['', 'win', 'loss', 'draw', 'other'], default: '' },
  score: { type: String, default: '', maxlength: 40 },
  notes: { type: String, default: '', maxlength: 500 },
  attempts: { type: [attemptSchema], default: undefined },
  distance: { type: String, default: '', maxlength: 40 },
  timeSec: { type: Number, min: 0, default: null },
  splits: { type: [splitSchema], default: undefined },
  method: { type: String, enum: ['', 'points', 'submission', 'decision', 'pin', 'ko', 'tko', 'other'], default: '' },
  opponent: { type: String, default: '', maxlength: 80 }
}, { _id: false });

// One-off competition or event (meet, game, race, match, and so on).
const eventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  sport: { type: String, required: true, maxlength: 80 },
  type: { type: String, required: true, maxlength: 40 },
  date: { type: String, required: true }, // local YYYY-MM-DD
  time: { type: String, default: '' }, // HH:MM, optional
  place: { type: String, default: '', maxlength: 120 },
  notes: { type: String, default: '', maxlength: 500 },
  resultKind: { type: String, enum: ['generic', 'lifting', 'race', 'match'], default: 'generic' },
  result: { type: resultSchema, default: undefined },
  weightClassLbs: { type: Number, min: 0, max: 800, default: null },
  weighInDate: { type: String, default: '' }, // YYYY-MM-DD; empty means the event date
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
eventSchema.index({ user: 1, date: 1 });
eventSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Event', eventSchema);
