const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 40
  },
  // Private: never returned on profiles, search, shares or comments (select: false).
  email: {
    type: String,
    trim: true,
    lowercase: true,
    select: false,
    index: true
  },
  // Private date of birth, 'YYYY-MM-DD' (local calendar). Set once; not self-editable.
  dob: { type: String, select: false },
  // 'under13': the person said they are under 13 after sign-up. Only sign out and delete work.
  accountLocked: { type: String, enum: ['', 'under13'], default: '' },
  passwordChangedAt: { type: Date },
  passwordHash: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    trim: true,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  sex: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
  birthYear: { type: Number, min: 1920, max: 2020 },
  heightCm: { type: Number, min: 100, max: 250 },
  avatar: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.verifyPassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 12);
};

// Usernames are matched without regard to case. Accounts keep the casing they
// were created with (for display). Exact match wins; otherwise a
// case-insensitive match (collation strength 2). If older data has several
// accounts that differ only by case, the exact match is tried first, then the
// others oldest first.
const CI_COLLATION = { locale: 'en', strength: 2 };

// All accounts matching a username ignoring case, exact match first (max 5).
userSchema.statics.findUsernameCandidates = async function (username) {
  const name = String(username || '').trim();
  if (!name) return [];
  const matches = await this.find({ username: name })
    .collation(CI_COLLATION)
    .sort({ createdAt: 1, _id: 1 })
    .limit(5);
  const exactIdx = matches.findIndex((u) => u.username === name);
  if (exactIdx > 0) matches.unshift(matches.splice(exactIdx, 1)[0]);
  if (exactIdx === -1) {
    const exact = await this.findOne({ username: name });
    if (exact) matches.unshift(exact);
  }
  return matches;
};

userSchema.statics.usernameTaken = async function (username) {
  const name = String(username || '').trim();
  if (!name) return false;
  const found = await this.findOne({ username: name }).collation(CI_COLLATION).select('_id');
  return !!found;
};

module.exports = mongoose.model('User', userSchema);
