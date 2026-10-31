const mongoose = require('mongoose');

// Public-profile settings. Everything is private by default: a user is not
// discoverable and no optional field is shown until they turn it on.
const FIELDS = ['avatar', 'bio', 'interests', 'workoutsThisMonth', 'streak', 'memberSince'];

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String, default: '', maxlength: 160 },
  discoverable: { type: Boolean, default: false },
  visibility: {
    avatar: { type: Boolean, default: false },
    bio: { type: Boolean, default: false },
    interests: { type: Boolean, default: false },
    workoutsThisMonth: { type: Boolean, default: false },
    streak: { type: Boolean, default: false },
    memberSince: { type: Boolean, default: false }
  },
  commentsSeenAt: { type: Date, default: () => new Date(0) },
  updatedAt: { type: Date, default: Date.now }
});
profileSchema.index({ discoverable: 1 });

profileSchema.statics.FIELDS = FIELDS;
module.exports = mongoose.model('Profile', profileSchema);
