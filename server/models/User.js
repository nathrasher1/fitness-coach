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
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
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
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.verifyPassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 12);
};

module.exports = mongoose.model('User', userSchema);
