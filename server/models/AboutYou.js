const mongoose = require('mongoose');

// Private "About you" answers. Never returned by profile, search, share or comment routes.
// Deleted with the account (it has a `user` path, which DELETE /api/account sweeps).
const aboutYouSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  goal: { type: String, default: '' },
  sex: { type: String, default: '' }, // female | male | unspecified | '' (not answered)
  heightCm: { type: Number, min: 100, max: 250 },
  experience: { type: String, default: '' },
  activity: { type: String, default: '' },
  equipment: [{ type: String }],
  easyOn: [{ type: String }],
  diet: [{ type: String }],
  avoid: [{ type: String }],
  // Teens only: share weight, BMI, measurements and photos with linked parents. Off by default, revocable.
  shareBodyWithParent: { type: Boolean, default: false },
  savedAt: { type: Date },      // set when the user presses Save at least once
  dismissedAt: { type: Date },  // set when the home card is dismissed / skipped
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AboutYou', aboutYouSchema);
