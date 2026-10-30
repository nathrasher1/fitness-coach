const mongoose = require('mongoose');

// One in-progress workout per user, so an unfinished session survives reloads and device switches.
// `data` is null after Finish/Discard: the row then acts as a tombstone so a late autosave from
// another tab (with an older savedAt) can't bring the cleared draft back.
const workoutDraftSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: null },
  savedAt: { type: Date, default: Date.now }
}, { minimize: false });

module.exports = mongoose.model('WorkoutDraft', workoutDraftSchema);
